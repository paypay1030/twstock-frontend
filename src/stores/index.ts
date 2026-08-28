import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TradeRecord, TradeType, AnalysisResponse, HoldingStats } from '@/types'

// ════════════════════════════════════════════════════════════
// LocalStorage Key 常數（固定不變，部署後資料不遺失）
// ════════════════════════════════════════════════════════════
export const STORAGE_KEYS = {
  trades:     'twstock_transactions_v1',
  settings:   'twstock_settings_v1',
  dividends:  'twstock_dividends_v1',
  watchlist:  'twstock_watchlist_v1',
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

import { calcFee, calcTax } from '@/lib/fee-calculator'

// ════════════════════════════════════════════════════════════
// 持股統計計算（純函數）
//
// 重要：realizedPnL 採「實際獲利」模式（非帳面獲利）
//   已實現損益 = 賣出實際回收（扣手續費+證交稅）
//              − 買進實際成本（含買進手續費，FIFO 配對）
// ════════════════════════════════════════════════════════════
export function calcHoldingStats(
  code: string,
  name: string,
  trades: TradeRecord[],
  currentPrice: number | null   // null = 現價尚未取得
): HoldingStats {
  const sorted = [...trades.filter(t => t.code === code)]
    .sort((a, b) => a.date.localeCompare(b.date))

  // 推導商品類型：取最近一筆有標記 instrumentType 的交易紀錄，缺省視為股票
  const instrumentType = [...sorted].reverse().find(t => t.instrumentType)?.instrumentType ?? 'stock'

  let currentShares  = 0
  let totalCostBasis = 0      // 含買進手續費的實際成本基礎（FIFO 佇列用）
  let realizedPnL    = 0      // 實際獲利（已扣買賣雙邊費稅）
  // FIFO 佇列：每筆記錄「實際單位成本」= 買進價 + 買進手續費攤銷後的每股成本
  const fifo: { unitCost: number; shares: number }[] = []

  for (const t of sorted) {
    const isBuy = t.type === 'buy' || t.type === 'add'

    if (isBuy) {
      const grossAmount = t.price * t.shares
      const buyFee      = calcFee(grossAmount)              // 買進手續費（已折扣）
      const actualCost  = grossAmount + buyFee               // 實際投入成本
      const unitCost    = t.shares > 0 ? actualCost / t.shares : 0

      currentShares  += t.shares
      totalCostBasis += actualCost
      fifo.push({ unitCost, shares: t.shares })
    } else {
      // 賣出/減碼：先算這筆賣出的實際回收（扣手續費+證交稅）
      const sellGross = t.price * t.shares
      const sellFee    = calcFee(sellGross)
      const sellTax    = calcTax(sellGross, instrumentType)
      const sellNet    = sellGross - sellFee - sellTax        // 實際到手金額

      let toSell = t.shares
      currentShares -= t.shares

      // FIFO 配對：依比例分攤這筆賣出的「實際回收」到每個被消耗的批次
      // （手續費/稅是整筆計算，依股數比例分攤至各批次以求出該批次的實際獲利）
      const netPerShare = t.shares > 0 ? sellNet / t.shares : 0

      while (toSell > 0 && fifo.length > 0) {
        const head = fifo[0]
        const sold = Math.min(head.shares, toSell)

        const costForSold = head.unitCost * sold        // 這批次被賣出股數的實際成本
        const recoverForSold = netPerShare * sold         // 這批次被賣出股數的實際回收（已分攤費稅）
        realizedPnL += recoverForSold - costForSold

        head.shares -= sold
        toSell      -= sold
        if (head.shares <= 0) fifo.shift()
      }

      // 重算剩餘持股的成本基礎（供 avgCost 顯示用，仍是「含買進手續費」的實際成本）
      totalCostBasis = fifo.reduce((s, b) => s + b.unitCost * b.shares, 0)
    }
  }

  const safeShares = Math.max(currentShares, 0)
  // avgCost：實際平均成本（含買進手續費攤銷），供「我的買進成本」顯示
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
    instrumentType,
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
  totalFund: number   // Phase 2.5：總資金，使用者手動輸入，用於計算現金部位
  trimRules: {
    near_resist:   number
    in_resist:     number
    fail_breakout: number
    break_support: number
  }
  setTotalFund: (amount: number) => void
  setTrimRules: (r: Partial<SettingsStore['trimRules']>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      totalFund: 0,
      trimRules: {
        near_resist:   0.20,
        in_resist:     0.30,
        fail_breakout: 0.50,
        break_support: 1.00,
      },
      setTotalFund: (amount) => set({ totalFund: Math.max(0, amount) }),
      setTrimRules: (r) => set(s => ({ trimRules: { ...s.trimRules, ...r } })),
    }),
    {
      name:    STORAGE_KEYS.settings,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // version 不同或缺少 totalFund 時，補上預設值 0，不清空既有 trimRules
      migrate: (persisted: any) => ({
        totalFund: persisted?.totalFund ?? 0,
        trimRules: persisted?.trimRules ?? {
          near_resist: 0.20, in_resist: 0.30, fail_breakout: 0.50, break_support: 1.00,
        },
      }),
    }
  )
)

// ════════════════════════════════════════════════════════════
// 股息紀錄 Store（Phase 2.5）
// ════════════════════════════════════════════════════════════
import type { DividendRecord, WatchlistItem } from '@/types'

interface DividendStore {
  dividends: DividendRecord[]
  addDividend:    (d: Omit<DividendRecord, 'id'>) => void
  updateDividend: (id: string, d: Partial<DividendRecord>) => void
  deleteDividend: (id: string) => void
}

export const useDividendStore = create<DividendStore>()(
  persist(
    (set) => ({
      dividends: [],
      addDividend: (d) => set(s => ({
        dividends: [{ ...d, id: crypto.randomUUID() }, ...s.dividends],
      })),
      updateDividend: (id, d) => set(s => ({
        dividends: s.dividends.map(x => x.id === id ? { ...x, ...d } : x),
      })),
      deleteDividend: (id) => set(s => ({
        dividends: s.dividends.filter(x => x.id !== id),
      })),
    }),
    {
      name:    STORAGE_KEYS.dividends,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted: any) => ({ dividends: persisted?.dividends ?? [] }),
    }
  )
)

// ════════════════════════════════════════════════════════════
// 自選股 Store（Phase 2.5）
// ════════════════════════════════════════════════════════════
interface WatchlistStore {
  watchlist: WatchlistItem[]
  addWatch:    (w: Omit<WatchlistItem, 'id'>) => void
  removeWatch: (id: string) => void
  isWatched:   (code: string) => boolean
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      watchlist: [],
      addWatch: (w) => set(s => {
        if (s.watchlist.some(x => x.code === w.code)) return s   // 避免重複加入
        return { watchlist: [{ ...w, id: crypto.randomUUID() }, ...s.watchlist] }
      }),
      removeWatch: (id) => set(s => ({
        watchlist: s.watchlist.filter(x => x.id !== id),
      })),
      isWatched: (code) => get().watchlist.some(x => x.code === code),
    }),
    {
      name:    STORAGE_KEYS.watchlist,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted: any) => ({ watchlist: persisted?.watchlist ?? [] }),
    }
  )
)

// ════════════════════════════════════════════════════════════
// 今日筆記 Store（useDailyNoteStore）
//
// 設計原則：
//   - 首頁從此 store 讀取，不再寫死 demo 資料
//   - 預設值為佔位內容，讓 UI 保持完整
//   - 未來 AI API 回傳後呼叫 setNote() 更新，首頁自動反映
//   - 不做 LocalStorage persist（每天重新取得最新內容）
// ════════════════════════════════════════════════════════════
import type { TodayNoteData } from '@/components/nb/TodayNoteCard'

/** 佔位預設值：UI 保持完整，提示使用者資料待載入 */
export const DEFAULT_TODAY_NOTE: TodayNoteData = {
  headline: '今天的市場分析準備中。',
  body: '稍後將由 AI 為你整理今天的重點判斷。',
  reasons: [],
  ifIWere: '請稍待，AI 正在分析今日市場狀況。',
  actions: ['先查看昨日持股狀況'],
  riskLevel: 'low',
  riskNote: '',
  confidence: 'mid',
}

interface DailyNoteStore {
  note: TodayNoteData
  isReady: boolean          // false = 尚未由 AI 更新，顯示佔位狀態
  setNote: (note: TodayNoteData) => void
  reset: () => void
}

export const useDailyNoteStore = create<DailyNoteStore>()((set) => ({
  note: DEFAULT_TODAY_NOTE,
  isReady: false,
  setNote: (note) => set({ note, isReady: true }),
  reset:   ()     => set({ note: DEFAULT_TODAY_NOTE, isReady: false }),
}))

