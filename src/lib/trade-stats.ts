/**
 * 交易紀錄統計計算（純函數）
 *
 * 核心：對每一檔股票的交易紀錄做 FIFO 配對，
 *       產生「每一筆已實現交易」的明細（含實際獲利、持有天數），
 *       再從這些明細推導勝率、平均獲利/虧損、最大值、年度統計。
 *
 * 重要：已實現損益一律採「實際獲利」（已扣買賣雙邊手續費 + 證交稅），
 *       與 calcHoldingStats 的 realizedPnL 計算口徑一致。
 */
import type { TradeRecord, RealizedTrade, TradeStatistics, YearlyTradeSummary, InstrumentType } from '@/types'
import { calcFee, calcTax } from '@/lib/fee-calculator'

/** 計算兩個 YYYY-MM-DD 日期字串相差天數 */
function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * 對單一股票的交易紀錄做 FIFO 配對，產生已實現交易明細列表
 * （邏輯與 calcHoldingStats 的 FIFO 部分一致，但這裡保留逐筆配對明細而非只算總額）
 */
function fifoRealize(
  trades: TradeRecord[],
  code: string,
  name: string,
  instrumentType: InstrumentType
): RealizedTrade[] {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  const fifo: { unitCost: number; shares: number; buyDate: string }[] = []
  const realized: RealizedTrade[] = []

  for (const t of sorted) {
    const isBuy = t.type === 'buy' || t.type === 'add'

    if (isBuy) {
      const grossAmount = t.price * t.shares
      const buyFee = calcFee(grossAmount)
      const unitCost = t.shares > 0 ? (grossAmount + buyFee) / t.shares : 0
      fifo.push({ unitCost, shares: t.shares, buyDate: t.date })
    } else {
      const sellGross = t.price * t.shares
      const sellFee = calcFee(sellGross)
      const sellTax = calcTax(sellGross, instrumentType)
      const sellNet = sellGross - sellFee - sellTax
      const netPerShare = t.shares > 0 ? sellNet / t.shares : 0

      let toSell = t.shares

      while (toSell > 0 && fifo.length > 0) {
        const head = fifo[0]
        const sold = Math.min(head.shares, toSell)

        const costForSold = head.unitCost * sold
        const recoverForSold = netPerShare * sold
        const realProfit = recoverForSold - costForSold

        realized.push({
          code, name,
          sellDate: t.date,
          buyDate: head.buyDate,
          shares: sold,
          realProfit: Math.round(realProfit),
          holdingDays: daysBetween(head.buyDate, t.date),
        })

        head.shares -= sold
        toSell      -= sold
        if (head.shares <= 0) fifo.shift()
      }
    }
  }

  return realized
}

/**
 * 計算完整交易統計（供交易紀錄頁使用）
 *
 * @param trades 全部交易紀錄（所有股票混合，函數內部自動依代號分組做 FIFO）
 * @param instrumentTypeMap 各股票代號對應的商品類型（股票/ETF），用於正確套用證交稅率
 */
export function calcTradeStatistics(
  trades: TradeRecord[],
  instrumentTypeMap: Record<string, InstrumentType> = {}
): TradeStatistics {
  // 依股票代號分組
  const byCode = new Map<string, { name: string; trades: TradeRecord[] }>()
  for (const t of trades) {
    if (!byCode.has(t.code)) byCode.set(t.code, { name: t.name, trades: [] })
    byCode.get(t.code)!.trades.push(t)
  }

  // 對每檔股票做 FIFO 配對，彙整所有已實現交易明細
  const allRealized: RealizedTrade[] = []
  for (const [code, { name, trades: codeTrades }] of byCode) {
    const instrumentType = instrumentTypeMap[code] ?? 'stock'
    allRealized.push(...fifoRealize(codeTrades, code, name, instrumentType))
  }

  if (allRealized.length === 0) {
    return {
      totalRealizedPnL: 0,
      winCount: 0, lossCount: 0, winRate: 0,
      avgGain: 0, avgLoss: 0,
      avgHoldingDays: null,
      maxGain: null, maxLoss: null,
      byYear: [],
    }
  }

  const totalRealizedPnL = allRealized.reduce((s, r) => s + r.realProfit, 0)

  const wins   = allRealized.filter(r => r.realProfit > 0)
  const losses = allRealized.filter(r => r.realProfit < 0)
  const winCount  = wins.length
  const lossCount = losses.length
  const winRate   = allRealized.length > 0
    ? Math.round((winCount / allRealized.length) * 1000) / 10   // 一位小數
    : 0

  const avgGain = wins.length > 0
    ? Math.round(wins.reduce((s, r) => s + r.realProfit, 0) / wins.length)
    : 0
  const avgLoss = losses.length > 0
    ? Math.round(losses.reduce((s, r) => s + r.realProfit, 0) / losses.length)
    : 0

  const withHoldingDays = allRealized.filter(r => r.holdingDays !== null) as (RealizedTrade & { holdingDays: number })[]
  const avgHoldingDays = withHoldingDays.length > 0
    ? Math.round(withHoldingDays.reduce((s, r) => s + r.holdingDays, 0) / withHoldingDays.length)
    : null

  const maxGainTrade = allRealized.reduce((max, r) =>
    !max || r.realProfit > max.realProfit ? r : max, null as RealizedTrade | null)
  const maxLossTrade = allRealized.reduce((min, r) =>
    !min || r.realProfit < min.realProfit ? r : min, null as RealizedTrade | null)

  const maxGain = maxGainTrade && maxGainTrade.realProfit > 0
    ? { code: maxGainTrade.code, name: maxGainTrade.name, amount: maxGainTrade.realProfit }
    : null
  const maxLoss = maxLossTrade && maxLossTrade.realProfit < 0
    ? { code: maxLossTrade.code, name: maxLossTrade.name, amount: maxLossTrade.realProfit }
    : null

  // 年度統計：依賣出日期的年份分組
  const yearMap = new Map<string, { pnl: number; count: number }>()
  for (const r of allRealized) {
    const year = r.sellDate.slice(0, 4)
    const existing = yearMap.get(year)
    if (existing) {
      existing.pnl += r.realProfit
      existing.count += 1
    } else {
      yearMap.set(year, { pnl: r.realProfit, count: 1 })
    }
  }
  const byYear: YearlyTradeSummary[] = Array.from(yearMap.entries())
    .map(([year, v]) => ({ year, realizedPnL: v.pnl, tradeCount: v.count }))
    .sort((a, b) => b.year.localeCompare(a.year))

  return {
    totalRealizedPnL,
    winCount, lossCount, winRate,
    avgGain, avgLoss,
    avgHoldingDays,
    maxGain, maxLoss,
    byYear,
  }
}
