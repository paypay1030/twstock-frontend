import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TradeRecord, TradeType, AnalysisResponse, HoldingStats, TrimResult, TrimBasis } from '@/types'

// ════════════════════════════════════════════════════════════
// 交易紀錄 Store（所有持股資料的唯一來源）
// ════════════════════════════════════════════════════════════
interface TradeStore {
  trades: TradeRecord[]
  addTrade:    (t: Omit<TradeRecord, 'id'>) => void
  updateTrade: (id: string, patch: Partial<Omit<TradeRecord,'id'>>) => void
  deleteTrade: (id: string) => void
  getByCode:   (code: string) => TradeRecord[]
}
export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      trades: [],
      addTrade: (t) => set(s => ({
        trades: [{ ...t, id: crypto.randomUUID() }, ...s.trades]
      })),
      updateTrade: (id, patch) => set(s => ({
        trades: s.trades.map(x => x.id === id ? { ...x, ...patch } : x)
      })),
      deleteTrade: (id) => set(s => ({ trades: s.trades.filter(x => x.id !== id) })),
      getByCode: (code) => get().trades.filter(t => t.code === code),
    }),
    { name: 'twstock-trades-v1' }
  )
)

// ════════════════════════════════════════════════════════════
// 自動建議交易類型
// ════════════════════════════════════════════════════════════
export function suggestTradeType(code: string, trades: TradeRecord[], dir: 'buy'|'sell'): TradeType {
  const sorted = [...trades.filter(t => t.code === code)].sort((a,b) => a.date.localeCompare(b.date))
  let shares = 0
  for (const t of sorted) {
    if (t.type === 'buy' || t.type === 'add') shares += t.shares
    else shares -= t.shares
  }
  if (dir === 'buy')  return shares > 0 ? 'add' : 'buy'
  return shares <= 0 ? 'sell' : 'reduce'
}

// ════════════════════════════════════════════════════════════
// 持股統計計算（FIFO，純函數）
// ════════════════════════════════════════════════════════════
export function calcHoldingStats(
  code: string,
  name: string,
  trades: TradeRecord[],
  currentPrice: number
): HoldingStats {
  const sorted = [...trades.filter(t => t.code === code)]
    .sort((a,b) => a.date.localeCompare(b.date))

  let currentShares = 0
  let totalCostBasis = 0
  let realizedPnL = 0
  const fifo: { price: number; shares: number }[] = []

  for (const t of sorted) {
    const isBuy = t.type === 'buy' || t.type === 'add'
    if (isBuy) {
      currentShares  += t.shares
      totalCostBasis += t.price * t.shares
      fifo.push({ price: t.price, shares: t.shares })
    } else {
      let toSell = t.shares
      currentShares -= t.shares
      while (toSell > 0 && fifo.length > 0) {
        const head = fifo[0]
        const sold = Math.min(head.shares, toSell)
        realizedPnL  += (t.price - head.price) * sold
        head.shares  -= sold
        toSell       -= sold
        if (head.shares <= 0) fifo.shift()
      }
      totalCostBasis = fifo.reduce((s,b) => s + b.price * b.shares, 0)
    }
  }

  const safeShares   = Math.max(currentShares, 0)
  const avgCost      = safeShares > 0 ? totalCostBasis / safeShares : 0
  const currentValue = safeShares * currentPrice
  const unrealizedPnL = currentValue - safeShares * avgCost
  const unrealizedPnLPct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0
  const distToBreak  = avgCost > 0 ? ((avgCost - currentPrice) / currentPrice) * 100 : 0

  const buys  = sorted.filter(t => t.type === 'buy' || t.type === 'add')
  const sells = sorted.filter(t => t.type === 'sell' || t.type === 'reduce')

  return {
    code, name,
    currentShares:      safeShares,
    avgCost:            Math.round(avgCost * 100) / 100,
    latestBuyPrice:     buys.at(-1)?.price ?? null,
    latestSellPrice:    sells.at(-1)?.price ?? null,
    latestBuyDate:      buys.at(-1)?.date ?? null,
    latestSellDate:     sells.at(-1)?.date ?? null,
    totalInvested:      Math.round(totalCostBasis),
    realizedPnL:        Math.round(realizedPnL),
    unrealizedPnL:      Math.round(unrealizedPnL),
    unrealizedPnLPct:   Math.round(unrealizedPnLPct * 100) / 100,
    currentValue:       Math.round(currentValue),
    distanceToBreakeven: Math.round(distToBreak * 100) / 100,
    isProfit:           currentPrice >= avgCost,
  }
}

// ════════════════════════════════════════════════════════════
// 智慧減碼計算（純函數）
// ════════════════════════════════════════════════════════════
export function calcTrim(
  shares: number,
  currentPrice: number,
  pct: number,           // 0~1
  trigger: string,
  basis: TrimBasis = 'shares',
  avgCost?: number
): TrimResult {
  let sellShares: number
  if (basis === 'value' && avgCost) {
    const totalValue = shares * currentPrice
    sellShares = Math.floor((totalValue * pct) / currentPrice)
  } else {
    sellShares = Math.floor(shares * pct)
  }
  sellShares = Math.min(sellShares, shares)
  const remain = shares - sellShares
  return {
    trigger,
    trimPct:       Math.round(pct * 100),
    sellShares,
    sellLots:      Math.floor(sellShares / 1000),
    remainShares:  remain,
    recoverAmount: Math.round(sellShares * currentPrice),
    remainValue:   Math.round(remain * currentPrice),
  }
}

export function getAutoTrimSuggestion(
  signalColor: string,
  shares: number,
  currentPrice: number,
  resistLow: number | null,
  rules: { near_resist: number; in_resist: number; break_support: number },
  basis: TrimBasis = 'shares',
  avgCost?: number
): TrimResult | null {
  if (signalColor === 'red') {
    return calcTrim(shares, currentPrice, rules.break_support, '跌破支撐，建議全部出清', basis, avgCost)
  }
  if (signalColor === 'orange') {
    const inResist = resistLow !== null && currentPrice >= resistLow
    return inResist
      ? calcTrim(shares, currentPrice, rules.in_resist,   '進入壓力區，建議減碼', basis, avgCost)
      : calcTrim(shares, currentPrice, rules.near_resist, '接近壓力區，建議部分減碼', basis, avgCost)
  }
  return null
}

// ════════════════════════════════════════════════════════════
// 分析快取
// ════════════════════════════════════════════════════════════
interface AnalysisStore {
  cache: Record<string, { data: AnalysisResponse; ts: number }>
  setCache: (code: string, d: AnalysisResponse) => void
  getCache: (code: string) => AnalysisResponse | null
}
export const useAnalysisStore = create<AnalysisStore>()((set, get) => ({
  cache: {},
  setCache: (code, data) => set(s => ({ cache: { ...s.cache, [code]: { data, ts: Date.now() } } })),
  getCache: (code) => {
    const entry = get().cache[code]
    if (!entry) return null
    if (Date.now() - entry.ts > 5 * 60 * 1000) return null   // 5分鐘過期
    return entry.data
  },
}))

// ════════════════════════════════════════════════════════════
// 設定 Store
// ════════════════════════════════════════════════════════════
export interface TrimRules {
  near_resist: number    // 接近壓力 → 減碼%
  in_resist: number      // 進入壓力 → 減碼%
  fail_breakout: number  // 突破失敗 → 減碼%
  break_support: number  // 跌破支撐 → 全出
}
interface SettingsStore {
  trimRules: TrimRules
  trimBasis: TrimBasis
  setTrimRules: (r: Partial<TrimRules>) => void
  setTrimBasis: (b: TrimBasis) => void
}
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      trimRules: { near_resist: 0.20, in_resist: 0.30, fail_breakout: 0.50, break_support: 1.00 },
      trimBasis: 'shares',
      setTrimRules: (r) => set(s => ({ trimRules: { ...s.trimRules, ...r } })),
      setTrimBasis: (b) => set({ trimBasis: b }),
    }),
    { name: 'twstock-settings-v1' }
  )
)
