// ════════════════════════════════════════════════════════════
// 股票分析相關
// ════════════════════════════════════════════════════════════
export interface StockBasic {
  symbol: string; code: string; name: string; market: string
  current_price: number; change: number; change_pct: number
  volume: number; week52_high: number; week52_low: number
  _mock?: boolean; _warning?: string
}
export interface KLine {
  date: string
  open: number | null; high: number | null; low: number | null
  close: number | null; volume: number
  ma20: number | null; ma60: number | null
  ma120: number | null; ma240: number | null
}
export interface SRLevel {
  rank: number; range_low: number; range_high: number
  label: string; strength: 'strong' | 'normal'; score: number; sources: string[]
}
export interface SRResult {
  support_levels: SRLevel[]; resistance_levels: SRLevel[]; stop_loss: number
}
export type SignalColor = 'green' | 'yellow' | 'orange' | 'red'
export interface Signal { color: SignalColor; emoji: string; label: string; desc: string }
export interface Risk {
  level: 'low' | 'medium' | 'high'; label: string; score: number
  cost_dist_score: number; support_dist_score: number; atr_score: number
}
export interface TriggerAction { condition: string; action: string }
export interface DecisionCard {
  stock: string; name: string; price: number
  signal: Signal; risk: Risk; main_action: string
  support_levels: SRLevel[]; resistance_levels: SRLevel[]
  stop_loss: number; triggers: TriggerAction[]; reason: string
  trim_suggestion: null; unstuck_evaluation: null
}
export interface AnalysisResponse {
  basic: StockBasic; sr_result: SRResult; decision_card: DecisionCard
  buy_zone: [number, number]; sell_zone: [number, number]
  stop_loss_zone: [number, number]; disclaimer: string
}
export interface SearchResult {
  code: string
  name: string
  market: string
  type?: string   // 股票 / ETF / 特別股 / ETN 等，與股票同級顯示，非必要欄位
}

// ════════════════════════════════════════════════════════════
// 交易紀錄 & 投資日誌
// ════════════════════════════════════════════════════════════
export type TradeType = 'buy' | 'add' | 'reduce' | 'sell'
export type ConfidenceLevel = 1 | 2 | 3

export const TRADE_META: Record<TradeType, {
  label: string; short: string
  badgeBg: string; badgeText: string
  rowBg: string; borderColor: string; textColor: string
}> = {
  buy:    { label:'買進', short:'買', badgeBg:'bg-red-500',     badgeText:'text-white', rowBg:'bg-red-50',     borderColor:'border-red-200',    textColor:'text-red-700' },
  add:    { label:'加碼', short:'加', badgeBg:'bg-orange-400',  badgeText:'text-white', rowBg:'bg-orange-50',  borderColor:'border-orange-200', textColor:'text-orange-700' },
  reduce: { label:'減碼', short:'減', badgeBg:'bg-teal-500',    badgeText:'text-white', rowBg:'bg-teal-50',    borderColor:'border-teal-200',   textColor:'text-teal-700' },
  sell:   { label:'賣出', short:'賣', badgeBg:'bg-emerald-600', badgeText:'text-white', rowBg:'bg-emerald-50', borderColor:'border-emerald-200',textColor:'text-emerald-700' },
}
export const CONFIDENCE_META: Record<ConfidenceLevel, { icon: string; label: string; desc: string }> = {
  1: { icon:'🌱', label:'謹慎',   desc:'不確定，小量試探' },
  2: { icon:'🌿', label:'普通',   desc:'一般信心，正常部位' },
  3: { icon:'🌳', label:'有把握', desc:'高度信心，較大部位' },
}

export type InstrumentType = 'stock' | 'etf'

export interface TradeRecord {
  id: string
  code: string
  name: string
  type: TradeType
  price: number
  shares: number
  date: string           // YYYY-MM-DD
  note?: string
  instrumentType?: InstrumentType   // 股票 / ETF，決定證交稅率；缺省視為 stock
  journal?: {
    reason: string
    confidence: ConfidenceLevel
  }
}

// ════════════════════════════════════════════════════════════
// 持股統計（前端從交易紀錄推導）
// ════════════════════════════════════════════════════════════
export interface HoldingStats {
  code: string; name: string
  currentShares: number
  avgCost: number
  latestBuyPrice: number | null
  latestSellPrice: number | null
  latestBuyDate: string | null
  latestSellDate: string | null
  totalInvested: number
  realizedPnL: number
  instrumentType: InstrumentType   // 股票或 ETF，決定證交稅率；從交易紀錄推導
  // 以下欄位依賴 currentPrice，未取得時為 null
  currentPrice: number | null
  unrealizedPnL: number | null
  unrealizedPnLPct: number | null
  currentValue: number | null
  distanceToBreakeven: number | null
  isProfit: boolean | null
}

// ════════════════════════════════════════════════════════════
// 智慧減碼試算
// ════════════════════════════════════════════════════════════
export interface TrimResult {
  trigger: string
  trimPct: number
  sellShares: number
  sellLots: number
  remainShares: number
  recoverAmount: number
  remainValue: number
}
export type TrimBasis = 'shares' | 'value'

// ════════════════════════════════════════════════════════════
// Phase 2.5：手續費／證交稅／真實獲利
// ════════════════════════════════════════════════════════════

/** 單筆買進或賣出的成交明細（含手續費拆解） */
export interface TradeFeeBreakdown {
  grossAmount: number   // 成交金額（價格 × 股數，未扣費）
  fee: number             // 手續費（已套用折扣，四捨五入至整數）
  tax: number              // 證交稅（僅賣出時收取；買進為 0）
  netAmount: number       // 實際金額：買進=grossAmount+fee；賣出=grossAmount-fee-tax
}

/** 單一持股的帳面 vs 實際損益（含手續費稅務）*/
export interface RealProfitResult {
  code: string
  // 帳面（不計費稅，沿用現有 HoldingStats 邏輯）
  bookCost: number
  bookValue: number
  bookPnL: number
  bookPnLPct: number
  // 實際（計入買進手續費 + 預估賣出手續費與證交稅）
  realCost: number          // 實際投入成本 = Σ(買進金額 + 買進手續費)
  estSellFee: number        // 若現在全部賣出，預估手續費
  estSellTax: number        // 若現在全部賣出，預估證交稅
  realPnL: number            // 實際損益 = bookValue - estSellFee - estSellTax - realCost
  realPnLPct: number
}

/** 減碼試算的完整費稅明細（賣多少頁面強化用）*/
export interface TrimFeeDetail {
  grossAmount: number     // 成交金額
  buyCostBasis: number    // 對應股數的買進成本（含當初買進手續費）
  fee: number               // 賣出手續費
  tax: number                // 賣出證交稅
  netRecover: number        // 實際回收 = grossAmount - fee - tax
  realProfit: number        // 實際獲利 = netRecover - buyCostBasis
}

// ════════════════════════════════════════════════════════════
// Phase 2.5：股息紀錄
// ════════════════════════════════════════════════════════════
export interface DividendRecord {
  id: string
  code: string
  name: string
  date: string      // YYYY-MM-DD
  amount: number    // 該筆股息金額（元，非每股）
  note?: string
}

// ════════════════════════════════════════════════════════════
// Phase 2.5：自選股
// ════════════════════════════════════════════════════════════
export interface WatchlistItem {
  id: string
  code: string
  name: string
  addedDate: string
  instrumentType?: InstrumentType
}

// ════════════════════════════════════════════════════════════
// Phase 2.5：真正總報酬 / 資產比例 / 交易統計
// ════════════════════════════════════════════════════════════
export interface TotalReturnResult {
  realizedPnL: number      // 已實現損益（實際獲利，已扣費稅）
  unrealizedPnL: number    // 未實現損益（帳面，依現價，未扣未來賣出費稅）
  dividendIncome: number   // 股息收入加總
  totalReturn: number       // 三者加總
}

export interface AssetAllocationItem {
  code: string
  name: string
  value: number
  pct: number
  instrumentType: InstrumentType
}
export interface AssetAllocationResult {
  stockValue: number
  etfValue: number
  cashValue: number
  total: number
  items: AssetAllocationItem[]
}

/** 單筆已實現交易明細（FIFO 配對後的結果，供統計引擎使用）*/
export interface RealizedTrade {
  code: string
  name: string
  sellDate: string
  buyDate: string | null     // FIFO 配對到的買進日期，可能因資料不全而為 null
  shares: number
  realProfit: number          // 此筆配對的實際獲利（已扣費稅）
  holdingDays: number | null  // 持有天數，buyDate 不存在時為 null
}

export interface YearlyTradeSummary {
  year: string
  realizedPnL: number
  tradeCount: number
}

export interface TradeStatistics {
  totalRealizedPnL: number
  winCount: number
  lossCount: number
  winRate: number              // 0~100
  avgGain: number                // 獲利交易的平均獲利（僅計正值交易）
  avgLoss: number                // 虧損交易的平均虧損（僅計負值交易，為負數或 0）
  avgHoldingDays: number | null
  maxGain: { code: string; name: string; amount: number } | null
  maxLoss: { code: string; name: string; amount: number } | null
  byYear: YearlyTradeSummary[]
}

// ════════════════════════════════════════════════════════════
// 技術指標（Phase 9：FastAPI 串接準備）
// ════════════════════════════════════════════════════════════

/**
 * 技術指標快照
 * FastAPI 端點：GET /api/analysis/{code}/indicators
 *
 * KLine 已含 MA20/60/120/240；此介面補充 RSI/MACD/KD 等動量指標。
 * 前端分析頁技術卡片由此資料驅動。
 */
/**
 * 技術指標快照（Phase 10：與 FastAPI /api/analysis/{code}/indicators 完整對齊）
 */
export interface TechIndicators {
  // 均線（最新值）
  ma5:   number | null
  ma10:  number | null
  ma20:  number | null
  ma60:  number | null
  ma240: number | null

  // RSI
  rsi:   number | null

  // MACD（巢狀物件）
  macd: {
    dif:  number | null   // 快線（DIF）
    dea:  number | null   // 慢線（DEA/Signal）
    hist: number | null   // 柱狀圖（×2，台灣慣例）
  }

  // KD 隨機指標（巢狀物件）
  kd: {
    k: number | null
    d: number | null
    j: number | null
  }

  // 布林通道（巢狀物件）
  bollinger: {
    upper:  number | null
    middle: number | null
    lower:  number | null
  }

  // 成交量（巢狀物件）
  volume: {
    current: number | null   // 今日成交量
    ma5:     number | null   // 5日均量
    ma20:    number | null   // 20日均量
  }

  // 趨勢判斷（後端計算）
  trend:       'bull' | 'bear' | 'neutral' | null
  trend_label: string | null

  // 元資料
  updated_at: string   // ISO 8601
}
