/**
 * API Service Layer
 *
 * 所有後端請求統一從此檔案發出，不可在元件或 Provider 內直接 fetch。
 *
 * BASE URL：NEXT_PUBLIC_API_URL（FastAPI）
 *   - 開發：http://localhost:8000
 *   - 生產：Vercel 環境變數設定
 *
 * 例外：/api/today-note 走 Next.js Route Handler（同 origin），
 *   未來 FastAPI 版本完成後，Route Handler 改為 proxy，呼叫端不需修改。
 */

import type {
  StockBasic, KLine, AnalysisResponse, SearchResult,
} from '@/types'
import type { TodayNoteResponse } from '@/app/api/today-note/route'

// ── 基礎設定 ─────────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** 統一 fetch wrapper：錯誤格式化、Content-Type */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // URL 路由規則：
  // 1. 完整 http/https URL → 直接使用
  // 2. /api/today-note    → Vercel Next.js Route Handler（同 origin）
  // 3. 其他 /api/*        → BASE + path（Render FastAPI）
  const VERCEL_ROUTES = ['/api/today-note']
  const url = path.startsWith('http')
    ? path
    : VERCEL_ROUTES.includes(path)
      ? path
      : `${BASE}${path}`

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '連線失敗' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ════════════════════════════════════════════════════════════
// 股票資料（FastAPI /api/stock/*）
// ════════════════════════════════════════════════════════════

/** 搜尋股票（代號 / 名稱模糊搜尋）*/
export async function searchStocks(q: string): Promise<SearchResult[]> {
  const data = await apiFetch<{ results: SearchResult[] }>(
    `/api/stock/search?q=${encodeURIComponent(q)}`
  )
  return data.results
}

/** 取得單一股票基本資料（現價、漲跌、52週高低等）*/
export async function getStockBasic(code: string): Promise<StockBasic> {
  return apiFetch<StockBasic>(`/api/stock/${code}`)
}

/** 取得股票 K 線歷史資料 */
export async function getStockHistory(code: string) {
  return apiFetch<{ code: string; klines: KLine[] }>(`/api/stock/${code}/history`)
}

// ════════════════════════════════════════════════════════════
// 技術分析（FastAPI /api/analysis/*）
// ════════════════════════════════════════════════════════════

/**
 * 純技術分析
 * 設計原則：不傳個人持股資訊，持股資料由前端從 Store 讀取並疊加。
 */
export async function analyzeStock(code: string): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>(`/api/analysis/${code}`, { method: 'POST' })
}

// ════════════════════════════════════════════════════════════
// 今日筆記（Next.js Route Handler /api/today-note）
// 未來：FastAPI 完成後 Route Handler 改為 proxy，此函數不需修改
// ════════════════════════════════════════════════════════════

/**
 * 取得今日 AI 筆記
 * 目前由 Next.js Route Handler 回傳 mock 資料。
 * FastAPI /api/today-note 完成後，Route Handler 自動 proxy，此函數不變。
 */
export async function getTodayNote(): Promise<TodayNoteResponse> {
  return apiFetch<TodayNoteResponse>('/api/today-note')
}

// ════════════════════════════════════════════════════════════
// 自選股現價批次取得
// 目前：逐一呼叫 getStockBasic（FastAPI 尚未提供批次端點）
// 未來：FastAPI 建立 /api/stock/batch?codes=2330,00878 後替換
// ════════════════════════════════════════════════════════════

export interface WatchlistPrice {
  code:      string
  price:     number | null
  change:    number | null
  changePct: number | null
  error?:    boolean
}

/**
 * 批次取得自選股現價
 * 目前實作：並行發送多個 getStockBasic 請求（無 batch 端點）
 * 未來替換為：apiFetch<WatchlistPrice[]>(`/api/stock/batch?codes=${codes.join(',')}`)
 */
export async function getWatchlistPrices(codes: string[]): Promise<WatchlistPrice[]> {
  if (codes.length === 0) return []

  const results = await Promise.allSettled(
    codes.map(code => getStockBasic(code))
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      const d = r.value
      return {
        code:      codes[i],
        price:     d.current_price ?? null,
        change:    d.change ?? null,
        changePct: d.change_pct ?? null,
      }
    }
    return { code: codes[i], price: null, change: null, changePct: null, error: true }
  })
}

// ════════════════════════════════════════════════════════════
// 【尚未串接 — 保留 Mock，架構與 FastAPI 一致】
// ════════════════════════════════════════════════════════════

/**
 * 大盤情境推估（Phase 2.6 第二階段）
 * FastAPI 端點：POST /api/market/scenario
 * @param taiexLevel 使用者輸入的大盤點數
 * @param holdingCodes 持股代號列表
 * TODO: FastAPI 實作後移除 mock
 */
export interface MarketScenarioRequest  { taiexLevel: number; holdingCodes: string[] }
export interface MarketScenarioResponse {
  taiexLevel: number
  estimations: { code: string; name: string; estimatedPrice: number; confidence: number }[]
}

export async function getMarketScenario(
  req: MarketScenarioRequest
): Promise<MarketScenarioResponse> {
  // TODO: 替換為 apiFetch<MarketScenarioResponse>('/api/market/scenario', { method:'POST', body: JSON.stringify(req) })
  return {
    taiexLevel:  req.taiexLevel,
    estimations: req.holdingCodes.map(code => ({
      code, name: code, estimatedPrice: 0, confidence: 0,
    })),
  }
}

// ════════════════════════════════════════════════════════════
// 法人買賣超（Phase 11）
// FastAPI 端點：GET /api/analysis/{code}/institutional
// ════════════════════════════════════════════════════════════

export type InstitutionalTrend = 'buy' | 'sell' | 'neutral' | 'unavailable'

export interface InstitutionalDayRecord {
  date:   string
  buy:    number | null
  sell:   number | null
  net:    number | null   // 買賣超張數（null = 無資料）
}

export interface InstitutionalSummary {
  foreignCumulative:    number | null
  investmentCumulative: number | null
  dealerCumulative:     number | null
  foreignTrend:         InstitutionalTrend
  investmentTrend:      InstitutionalTrend
  dealerTrend:          InstitutionalTrend
}

export interface InstitutionalResponse {
  foreign:    InstitutionalDayRecord[]
  investment: InstitutionalDayRecord[]
  dealer:     InstitutionalDayRecord[]
  summary:    InstitutionalSummary
  plainTalk:  string
  dataSource: string   // 'unavailable' | 'TWSE T86' | 'TPEX OpenAPI'
  updatedAt:  string
  note?:      string
}

export async function getInstitutional(code: string): Promise<InstitutionalResponse | null> {
  try {
    return await apiFetch<InstitutionalResponse>(`/api/analysis/${code}/institutional`)
  } catch (e) {
    console.warn(`[getInstitutional] ${code}:`, e)
    return null
  }
}

// ════════════════════════════════════════════════════════════
// 技術指標（Phase 10：已串接 FastAPI）
// FastAPI 端點：GET /api/analysis/{code}/indicators
// ════════════════════════════════════════════════════════════
import type { TechIndicators } from '@/types'

/**
 * 取得股票技術指標快照（RSI、MACD、KD、布林通道等）
 * FastAPI 端點：GET /api/analysis/{code}/indicators
 */
export async function getTechIndicators(code: string): Promise<TechIndicators | null> {
  try {
    return await apiFetch<TechIndicators>(`/api/analysis/${code}/indicators`)
  } catch {
    // 端點不可用時回傳 null，前端顯示「—」，不中斷其他功能
    return null
  }
}

/**
 * 取得分析頁完整技術資料（basic + klines + indicators 三合一）
 * FastAPI 端點：GET /api/analysis/{code}/full（尚未實作）
 *
 * 目前：分三個請求取得（analyzeStock + getStockHistory + getTechIndicators）
 * 未來：若後端提供合併端點，改為單一 apiFetch，呼叫端不需修改
 *
 * @param code 股票代號
 */
export async function getFullAnalysis(code: string) {
  const [analysis, history, indicators] = await Promise.allSettled([
    analyzeStock(code),
    getStockHistory(code),
    getTechIndicators(code),
  ])

  return {
    analysis:   analysis.status   === 'fulfilled' ? analysis.value   : null,
    history:    history.status    === 'fulfilled' ? history.value    : null,
    indicators: indicators.status === 'fulfilled' ? indicators.value : null,
  }
}
