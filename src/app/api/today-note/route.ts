/**
 * GET /api/today-note
 *
 * Proxy → FastAPI GET /api/today-note
 * FastAPI 根據 ^TWII 加權指數即時資料產生今日市場摘要。
 *
 * FastAPI 不可用時 fallback 回 DEFAULT_NOTE（讓首頁不空白）。
 * 前端 TodayNoteCard UI 完全不需要修改。
 */
import { NextResponse } from 'next/server'
import type { TodayNoteData } from '@/components/nb/TodayNoteCard'

export interface TodayNoteResponse extends TodayNoteData {
  generatedAt: string
  source: 'market_data' | 'mock' | 'unavailable'
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// FastAPI 不可用時的 fallback（不使用假市場數字）
const FALLBACK: TodayNoteResponse = {
  headline:    '今天暫時無法取得市場資料。',
  body:        '目前無法連線取得大盤資料，請稍後再試。',
  reasons:     ['市場資料暫時無法取得'],
  ifIWere:     '如果是我，今天先暫停操作，等資料恢復後再評估。',
  actions:     ['等待資料恢復後再評估'],
  riskLevel:   'mid',
  riskNote:    '今天無法取得大盤資料，建議暫停操作',
  confidence:  'low',
  generatedAt: new Date().toISOString(),
  source:      'unavailable',
}

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/today-note`, {
      next: { revalidate: 900 },   // Vercel ISR：15 分鐘重新驗證
    })
    if (!res.ok) throw new Error(`FastAPI ${res.status}`)
    const data: TodayNoteResponse = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.warn('[today-note proxy] FastAPI unavailable, using fallback:', e)
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
