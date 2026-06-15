import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TradeRecord, TradeType, AnalysisResponse, HoldingStats } from '@/types'

// ════════════════════════════════════════════════════════════
// 交易紀錄 Store
// ════════════════════════════════════════════════════════════
interface TradeStore {
  trades: TradeRecord[]
  addTrade:    (t: Omit<TradeRecord, 'id'>) => void
  updateTrade: (id: string, t: Partial<TradeRecord>) => void
  deleteTrade: (id: string) => void
  getByCode:   (code: string) => TradeRecord[]
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      trades: [],
      addTrade:    (t) => set(s => ({ trades: [{ ...t, id: crypto.randomUUID() }, ...s.trades] })),
      updateTrade: (id, t) => set(s => ({ trades: s.trades.map(x => x.id === id ? { ...x, ...t } : x) })),
      deleteTrade: (id) => set(s => ({ trades: s.trades.filter(x => x.id !== id) })),
      getByCode:   (code) => get().trades.filter(t => t.code === code),
    }),
    { name: 'twstock-trades' }
  )
)

// ════════════════════════════════════════════════════════════
// 自動建議交易類型
// ════════════════════════════════════════════════════════════
export function suggestTradeType(
  code: string, trades: TradeRecord[], direction: 'buy' | 'sell'
): TradeType {
  const codeTrades = trades.filter(t => t.code === code)
  let shares = 0
  for (const t of codeTrades) {
    if (t.type === 'buy' || t.type === 'add') shares += t.shares
    else shares -= t.shares
  }
  if (direction === 'buy')  return shares > 0 ? 'add' : 'buy'
  else                       return shares <= 0 ? 'sell' : 'reduce'
}

// ════════════════════════════════════════════════════════════
// 持股統計計算
//
// currentPrice 傳入規則：
//   - 已取得現價 → 傳入數字（> 0）
//   - 尚未取得   → 傳入 null
//
// 傳入 null 時，所有依賴 currentPrice 的欄位也為 null，
// 防止顯示層出現 $0 / -100% 等假性數值。
// ════════════════════════════════════════════════════════════
export function calcHoldingStats(
  code: string,
  name: string,
  trades: TradeRecord[],
  currentPrice: number | null   // ← null = 尚未取得，禁止回退到 0
): HoldingStats {
  const sorted = [...trades.filter(t => t.code === code)]
    .sort((a, b) => a.date.localeCompare(b.date))

  let currentShares  = 0
  let totalCostBasis = 0
  let realizedPnL    = 0
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
      totalCostBasis = fifo.reduce((s, b) => s + b.price * b.shares, 0)
    }
  }

  const safeShares = Math.max(currentShares, 0)
  const avgCost    = safeShares > 0 ? totalCostBasis / safeShares : 0

  const buys  = sorted.filter(t => t.type === 'buy' || t.type === 'add')
  const sells = sorted.filter(t => t.type === 'sell' || t.type === 'reduce')

  // ── 依賴 currentPrice 的欄位：null = 未取得 ──────────────
  let currentValueField:       number | null = null
  let unrealizedPnLField:      number | null = null
  let unrealizedPnLPctField:   number | null = null
  let distanceToBreakevenField: number | null = null
  let isProfitField:           boolean | null = null

  if (currentPrice !== null && currentPrice > 0) {
    currentValueField         = Math.round(safeShares * currentPrice)
    unrealizedPnLField        = Math.round(currentValueField - safeShares * avgCost)
    unrealizedPnLPctField     = avgCost > 0
      ? Math.round(((currentPrice - avgCost) / avgCost) * 10000) / 100
      : null
    distanceToBreakevenField  = avgCost > 0
      ? Math.round(((avgCost - currentPrice) / currentPrice) * 10000) / 100
      : null
    isProfitField             = currentPrice >= avgCost
  }

  return {
    code, name,
    currentShares:       safeShares,
    avgCost:             Math.round(avgCost * 100) / 100,
    latestBuyPrice:      buys.at(-1)?.price  ?? null,
    latestSellPrice:     sells.at(-1)?.price ?? null,
    latestBuyDate:       buys.at(-1)?.date   ?? null,
    latestSellDate:      sells.at(-1)?.date  ?? null,
    totalInvested:       Math.round(totalCostBasis),
    realizedPnL:         Math.round(realizedPnL),
    // 現價相關（可能為 null）
    currentPrice,
    currentValue:         currentValueField,
    unrealizedPnL:        unrealizedPnLField,
    unrealizedPnLPct:     unrealizedPnLPctField,
    distanceToBreakeven:  distanceToBreakevenField,
    isProfit:             isProfitField,
  }
}

// ════════════════════════════════════════════════════════════
// 分析快取 Store
// ════════════════════════════════════════════════════════════
interface AnalysisStore {
  cache: Record<string, AnalysisResponse>
  setCache: (code: string, d: AnalysisResponse) => void
  getCache: (code: string) => AnalysisResponse | undefined
}
export const useAnalysisStore = create<AnalysisStore>()((set, get) => ({
  cache: {},
  setCache: (code, d) => set(s => ({ cache: { ...s.cache, [code]: d } })),
  getCache: (code) => get().cache[code],
}))

// ════════════════════════════════════════════════════════════
// 設定 Store
// ════════════════════════════════════════════════════════════
interface SettingsStore {
  trimRules: {
    near_resist:   number
    in_resist:     number
    fail_breakout: number
    break_support: number
  }
  setTrimRules: (r: Partial<SettingsStore['trimRules']>) => void
}
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      trimRules: {
        near_resist:   0.20,
        in_resist:     0.30,
        fail_breakout: 0.50,
        break_support: 1.00,
      },
      setTrimRules: (r) => set(s => ({ trimRules: { ...s.trimRules, ...r } })),
    }),
    { name: 'twstock-settings' }
  )
)
