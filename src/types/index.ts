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
  date: string; open: number; high: number; low: number; close: number; volume: number
  ma20: number | null; ma60: number | null; ma120: number | null; ma240: number | null
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
export interface SearchResult { code: string; name: string; market: string }

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

export interface TradeRecord {
  id: string
  code: string
  name: string
  type: TradeType
  price: number
  shares: number
  date: string           // YYYY-MM-DD
  note?: string
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
