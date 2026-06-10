'use client'
import { useTradeStore } from '@/stores'
import TradeTimeline from '@/components/cards/TradeTimeline'

import { useMemo } from 'react'

export default function TradesPage() {
  const { trades, deleteTrade } = useTradeStore()
  const byCode = useMemo(() => {
    const m: Record<string, typeof trades> = {}
    for (const t of trades) {
      if (!m[t.code]) m[t.code] = []
      m[t.code].push(t)
    }
    return m
  }, [trades])

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-stone-800 mb-4">所有交易紀錄</h1>
        {Object.keys(byCode).length === 0 && (
          <div className="text-center py-16 text-stone-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm">尚無交易紀錄</div>
          </div>
        )}
        {Object.entries(byCode).map(([code, ts]) => (
          <div key={code} className="mb-6">
            <div className="text-sm font-bold text-stone-700 mb-2">
              {ts[0].name} {code}
            </div>
            <TradeTimeline trades={ts} onDelete={deleteTrade} maxVisible={100} />
          </div>
        ))}
      </div>
    </div>
  )
}
