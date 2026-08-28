'use client'

import { useState } from 'react'
import { useUIStore } from '@/stores/ui'

export interface TodayNoteData {
  headline: string
  body: string
  reasons: string[]
  ifIWere: string
  actions: string[]
  riskLevel: 'low' | 'mid' | 'high'
  riskNote: string
  confidence: 'high' | 'mid' | 'low'
}

interface Props {
  data: TodayNoteData
  compact?: boolean         // 首頁用大卡；分析頁用稍小版
}

// 把握程度標籤（不顯示數字）
const CONFIDENCE_MAP = {
  high: { label: '🟢 高把握',     cls: 'text-nb-green' },
  mid:  { label: '🟡 普通把握',   cls: 'text-nb-yellow' },
  low:  { label: '🔴 今天變數較大', cls: 'text-nb-red' },
}

// 風險等級
const RISK_MAP = {
  low:  { label: '🟢 今日無重大風險', cls: 'text-nb-green' },
  mid:  { label: '🟡 留意盤中變化',   cls: 'text-nb-yellow' },
  high: { label: '🔴 留意跌破支撐',   cls: 'text-nb-red' },
}

export default function TodayNoteCard({ data, compact = false }: Props) {
  const { techMode } = useUIStore()
  const [showReasons, setShowReasons] = useState(false)

  const conf = CONFIDENCE_MAP[data.confidence]
  const risk = RISK_MAP[data.riskLevel]

  return (
    <div className={`
      relative overflow-hidden rounded-3xl
      bg-gradient-to-br from-nb-s2 to-[#EBE0CF]
      border border-nb-border2
      shadow-nb-lg
      ${compact ? 'p-4' : 'p-5'}
    `}>
      {/* 裝飾性筆記本圖案 */}
      <span className="
        absolute right-4 top-3 text-5xl opacity-[.08]
        rotate-[10deg] select-none pointer-events-none
      ">
        📒
      </span>

      {/* 頂部：標題 + 把握程度（文字標籤，不顯示數字）*/}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-extrabold text-nb-t3 tracking-widest uppercase">
          今天的小筆記
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-extrabold ${conf.cls}`}>
            {conf.label}
          </span>
        </div>
      </div>

      {/* ① 一句結論（最大、最重要）*/}
      <p className={`
        font-black text-nb-t0 leading-snug tracking-tight
        ${compact ? 'text-[17px]' : 'text-[20px]'}
        mb-4
      `}>
        {data.headline}
      </p>

      {/* ② 今日動作（直接顯示，讓使用者一打開就知道今天要做什麼）*/}
      {data.actions.length > 0 && (
        <div className="bg-nb-s0/55 rounded-xl px-3.5 py-3 mb-4 space-y-1.5">
          {data.actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-nb-green font-extrabold text-[12px] flex-shrink-0">✔</span>
              <span className="text-[12px] font-bold text-nb-t0">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* ③ 如果是我（直接顯示，不展開）*/}
      <div className="
        bg-nb-s0/50 rounded-xl px-3.5 py-3 mb-4
        border-l-[3px] border-nb-orange
      ">
        <div className="text-[10px] font-extrabold text-nb-orange tracking-wide mb-1.5">
          如果是我，今天會……
        </div>
        <p className="text-[13px] text-nb-t0 leading-[1.8] whitespace-pre-line">
          {data.ifIWere}
        </p>
      </div>

      {/* ④ 為什麼（可展開，原因分析）*/}
      <button
        onClick={() => setShowReasons(v => !v)}
        className="
          w-full flex items-center justify-between
          bg-nb-s0/50 rounded-xl px-3.5 py-2.5
          text-[12px] font-extrabold text-nb-t1
          mb-2 transition-colors hover:bg-nb-s0/70
        "
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]">🔍</span>
          <span>{techMode ? '技術面判斷依據' : '為什麼我這樣判斷？'}</span>
        </div>
        <span className={`text-nb-t3 text-[10px] transition-transform ${showReasons ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {showReasons && (
        <div className="bg-nb-s0/50 rounded-xl px-3.5 py-3 mb-3 animate-fade-in">
          {data.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-nb-border/40 last:border-0">
              <span className="text-nb-green font-extrabold text-[11px] mt-0.5 flex-shrink-0">✔</span>
              <span className="text-[12px] text-nb-t1 leading-[1.6]">{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* ⑤ 今日風險提醒（直接顯示）*/}
      <div className="flex items-center gap-2 mt-1 pt-3 border-t border-nb-border/40">
        <span className={`text-[11px] font-extrabold ${risk.cls}`}>{risk.label}</span>
        {data.riskNote && (
          <span className="text-[11px] text-nb-t2">{data.riskNote}</span>
        )}
      </div>
    </div>
  )
}
