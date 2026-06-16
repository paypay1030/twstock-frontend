import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TradeRecord, TradeType, AnalysisResponse, HoldingStats } from '@/types'

// ════════════════════════════════════════════════════════════
// LocalStorage Key 常數（固定不變，部署後資料不遺失）
// ════════════════════════════════════════════════════════════
export const STORAGE_KEYS = {
  trades:   'twstock_transactions_v1',
  settings: 'twstock_settings_v1',
} as const

// ════════════════════════════════════════════════════════════
// 資料版本遷移（舊 key → 新 key）
// 在 App 初始化時呼叫一次（見 GlobalHeader）
// ════════════════════════════════════════════════════════════
export function migrateLocalStorage() {
  if (typeof window === 'undefined') return

  const migrations = [
    // 舊 Zustand 自動 key → 新固定 key
    { from: 'twstock-trades',     to: STORAGE_KEYS.trades },
    // 更舊的持股格式：holdings → trades
    {
      from: 'twstock-holdings',
      to:   STORAGE_KEYS.trades,
      transform: (raw: string) => {
        try {
          const parsed = JSON.parse(raw)
          const holdings = parsed?.state?.holdings ?? parsed?.holdings ?? []
          if (!Array.isArray(holdings) || holdings.length === 0) return null
          const trades: TradeRecord[] = holdings
            .map((h: any) => ({
              id:     h.id ?? crypto.randomUUID(),
              code:   h.code ?? h.stock ?? '',
              name:   h.name ?? h.code ?? '',
              type:   'buy' as TradeType,
              price:  Number(h.cost ?? 0),
              shares: Number(h.shares ?? 0),
              date:   h.date ?? new Date().toISOString().split('T')[0],
              note:   '從舊版資料自動遷移',
            }))
            .filter((t: TradeRecord) => t.code && t.shares > 0)
          if (trades.length === 0) return null
          return JSON.stringify({ state: { trades }, version: 1 })
        } catch { return null }
      },
    },
  ] as const

  for (const m of migrations) {
    if (localStorage.getItem(m.to)) continue     // 新 key 已存在，略過
    const old = localStorage.getItem(m.from)
    if (!old) continue

    const migrated = 'transform' in m
      ? m.transform(old)
      : old   // 格式相同，直接搬

    if (migrated) {
      localStorage.setItem(m.to, migrated)
      console.info(`[migrate] ${m.from} → ${m.to}`)
    }
  }
}

// ════════════════════════════════════════════════════════════
// 交易紀錄 Store
// ════════════════════════════════════════════════════════════
interface TradeStore {
  trades: TradeRecord[]
  addTrade:    (t: Omit<TradeRecord, 'id'>) => void
  updateTrade: (id: string, t: Partial<TradeRecord>) => void
  deleteTrade: (id: string) => void
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set) => ({
      trades: [],
      addTrade:    (t) => set(s => ({
        trades: [{ ...t, id: crypto.randomUUID() }, ...s.trades],
      })),
      updateTrade: (id, t) => set(s => ({
        trades: s.trades.map(x => x.id === id ? { ...x, ...t } : x),
      })),
      deleteTrade: (id) => set(s => ({
        trades: s.trades.filter(x => x.id !== id),
      })),
    }),
    {
      name:    STORAGE_KEYS.trades,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // version 不同時保留資料（不清空）
      migrate: (persisted: any, version: number) => {
        // v0 → v1：結構不變，直接沿用
        if (version === 0 && persisted?.trades) return persisted
        return persisted
      },
    }
  )
)

// ════════════════════════════════════════════════════════════
// 自動建議交易類型
// ════════════════════════════════════════════════════════════
export function suggestTradeType(
  code: string, trades: TradeRecord[], direction: 'buy' | 'sell'
): TradeType {
  let shares = 0
  for (const t of trades.filter(x => x.code === code)) {
    if (t.type === 'buy' || t.type === 'add') shares += t.shares
    else shares -= t.shares
  }
  if (direction === 'buy')  return shares > 0 ? 'add' : 'buy'
  return shares <= 0 ? 'sell' : 'reduce'
}

// ════════════════════════════════════════════════════════════
// 持股統計計算（純函數）
// ════════════════════════════════════════════════════════════
export function calcHoldingStats(
  code: string,
  name: string,
  trades: TradeRecord[],
  currentPrice: number | null   // null = 現價尚未取得
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
  const buys       = sorted.filter(t => t.type === 'buy' || t.type === 'add')
  const sells      = sorted.filter(t => t.type === 'sell' || t.type === 'reduce')

  // ── 依賴 currentPrice 的欄位（null = 尚未取得，不計算假性數值）──
  let currentValueField:        number | null = null
  let unrealizedPnLField:       number | null = null
  let unrealizedPnLPctField:    number | null = null
  let distanceToBreakevenField: number | null = null
  let isProfitField:            boolean | null = null

  if (currentPrice !== null && currentPrice > 0) {
    currentValueField        = Math.round(safeShares * currentPrice)
    unrealizedPnLField       = Math.round(currentValueField - safeShares * avgCost)
    unrealizedPnLPctField    = avgCost > 0
      ? Math.round(((currentPrice - avgCost) / avgCost) * 10000) / 100
      : null
    distanceToBreakevenField = avgCost > 0
      ? Math.round(((avgCost - currentPrice) / currentPrice) * 10000) / 100
      : null
    isProfitField = currentPrice >= avgCost
  }

  return {
    code, name,
    currentShares:        safeShares,
    avgCost:              Math.round(avgCost * 100) / 100,
    latestBuyPrice:       buys.at(-1)?.price  ?? null,
    latestSellPrice:      sells.at(-1)?.price ?? null,
    latestBuyDate:        buys.at(-1)?.date   ?? null,
    latestSellDate:       sells.at(-1)?.date  ?? null,
    totalInvested:        Math.round(totalCostBasis),
    realizedPnL:          Math.round(realizedPnL),
    currentPrice,
    currentValue:         currentValueField,
    unrealizedPnL:        unrealizedPnLField,
    unrealizedPnLPct:     unrealizedPnLPctField,
    distanceToBreakeven:  distanceToBreakevenField,
    isProfit:             isProfitField,
  }
}

// ════════════════════════════════════════════════════════════
// 分析結果快取（session 內，不持久化）
// ════════════════════════════════════════════════════════════
interface AnalysisStore {
  cache: Record<string, AnalysisResponse>
  setCache: (code: string, d: AnalysisResponse) => void
  getCache: (code: string) => AnalysisResponse | undefined
}
export const useAnalysisStore = create<AnalysisStore>()((set, get) => ({
  cache:    {},
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
    {
      name:    STORAGE_KEYS.settings,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted: any) => persisted,
    }
  )
)
