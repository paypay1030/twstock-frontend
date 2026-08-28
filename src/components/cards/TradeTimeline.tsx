'use client'

import { useState } from 'react'
import type { TradeRecord } from '@/types'
import { TRADE_META, CONFIDENCE_META } from '@/types'

interface Props {
  trades: TradeRecord[]
  onDelete?: (id: string) => void
  maxVisible?: number
}

function TimelineItem({ t, isLast, onDelete }: {
  t: TradeRecord; isLast: boolean; onDelete?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const m = TRADE_META[t.type]
  const amt = Math.round(t.price * t.shares)
  const hasJ = !!t.journal?.reason

  return (
    <div className="flex gap-3">
      {/* 軸線 */}
      <div className="flex flex-col items-center w-7 flex-shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${m.badgeBg} ${m.badgeText}`}>
          {m.short}
        </div>
        {!isLast && <div className="w-px flex-1 bg-nb-border mt-1 mb-0 min-h-[12px]" />}
      </div>

      {/* 內容 */}
      <div className={`flex-1 mb-3 rounded-xl border overflow-hidden ${m.borderColor}`}>
        <div
          className={`px-3 py-2.5 flex justify-between items-start ${m.rowBg} ${hasJ ? 'cursor-pointer' : ''}`}
          onClick={() => hasJ && setOpen(!open)}
        >
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-sm font-bold ${m.textColor}`}>{t.price}</span>
              <span className="text-xs text-nb-t2">× {t.shares.toLocaleString()} 股</span>
              <span className="text-[10px] text-nb-t2 bg-nb-s0/60 px-1.5 py-0.5 rounded-full">
                ${amt.toLocaleString()}
              </span>
            </div>
            {t.note && <div className="text-[11px] text-nb-t2 mt-0.5 leading-snug">{t.note}</div>}
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-nb-t2">{t.date}</div>
              {t.journal && (
                <div className="text-[11px] mt-0.5">
                  {CONFIDENCE_META[t.journal.confidence].icon}
                  <span className="text-nb-t2 ml-0.5">{CONFIDENCE_META[t.journal.confidence].label}</span>
                </div>
              )}
            </div>
            {hasJ && <span className="text-nb-t3 text-[10px]">{open ? '▲' : '▼'}</span>}
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(t.id) }}
                className="text-nb-t3 hover:text-nb-up text-xs w-5 h-5 flex items-center justify-center"
              >×</button>
            )}
          </div>
        </div>

        {/* 投資日誌 */}
        {open && t.journal && (
          <div className="px-3 py-2.5 bg-nb-orange-bg border-t border-nb-orange/20">
            <div className="text-[10px] font-bold text-nb-orange mb-1">{m.label}原因</div>
            <div className="text-xs text-nb-t1 leading-relaxed">{t.journal.reason}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TradeTimeline({ trades, onDelete, maxVisible = 5 }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (trades.length === 0) {
    return <div className="text-center py-5 text-xs text-nb-t2">尚無交易紀錄</div>
  }

  const sorted  = [...trades].sort((a,b) => b.date.localeCompare(a.date))
  const visible = showAll ? sorted : sorted.slice(0, maxVisible)
  const hasMore = sorted.length > maxVisible

  // 統計
  const counts = sorted.reduce((acc, t) => { acc[t.type] = (acc[t.type]||0)+1; return acc }, {} as Record<string,number>)

  return (
    <div>
      <div className="flex gap-3 mb-3 text-[11px] text-nb-t2 flex-wrap">
        {Object.entries(counts).map(([type, count]) => (
          <span key={type}>
            <span className={`font-bold ${TRADE_META[type as keyof typeof TRADE_META]?.textColor}`}>
              {TRADE_META[type as keyof typeof TRADE_META]?.label}
            </span>
            &nbsp;{count}次
          </span>
        ))}
      </div>

      <div>
        {visible.map((t, i) => (
          <TimelineItem
            key={t.id} t={t}
            isLast={i === visible.length - 1 && !hasMore}
            onDelete={onDelete}
          />
        ))}
      </div>

      {hasMore && (
        <button onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-xs font-medium text-nb-orange"
        >
          {showAll ? '收起' : `查看全部 ${sorted.length} 筆 ▼`}
        </button>
      )}
    </div>
  )
}
