import type { StockBasic, KLine, AnalysisResponse, SearchResult } from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '連線失敗' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function searchStocks(q: string): Promise<SearchResult[]> {
  const data = await apiFetch<{ results: SearchResult[] }>(
    `/api/stock/search?q=${encodeURIComponent(q)}`
  )
  return data.results
}

export async function getStockBasic(code: string): Promise<StockBasic> {
  return apiFetch<StockBasic>(`/api/stock/${code}`)
}

export async function getStockHistory(code: string) {
  return apiFetch<{ code: string; klines: KLine[] }>(`/api/stock/${code}/history`)
}

/**
 * 純技術分析：不傳個人持股資訊
 * 持股資訊由前端從 LocalStorage 讀取並疊加顯示
 */
export async function analyzeStock(code: string): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>(`/api/analysis/${code}`, { method: 'POST' })
}
