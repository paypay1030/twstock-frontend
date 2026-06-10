'use client'

import { useState } from 'react'
import type { HoldingStats } from '@/types'
import { generateUnstuckText } from '@/lib/plain-talk'
import { useUIStore } from '@/stores/ui'

interface Props { stats: HoldingStats; defaultView?: 'ring' | 'bar' }

const fmt = (n: number) => n.toLocaleString('zh-TW')

function RingProgress({ stats }: { stats: HoldingStats }) {
  const { techMode } = useUIStore()
  const { avgCost, currentShares, distanceToBreakeven, isProfit, currentValue, unrealizedPnL } = stats
  const price = currentShares > 0 ? currentValue / currentShares : 0

  const lowAnchor = Math.min(price, avgCost) * 0.88
  const range     = avgCost - lowAnchor
  const progress  = range > 0 ? Math.max(0, Math.min(1, (price - lowAnchor) / range)) : 1
  const pct       = isProfit ? 100 : Math.round(progress * 100)

  const ringColor = isProfit ? '#16A34A' : pct > 70 ? '#F59E0B' : pct > 40 ? '#F97316' : '#EF4444'
  const C = 2 * Math.PI * 58

  const unstuck = generateUnstuckText(avgCost, price, currentShares, distanceToBreakeven)

  return (
    <div className="flex flex-col items-center py-4 px-2">
      {/* 環形 */}
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140"
          style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r="58" fill="none"
            stroke={isProfit ? '#DCFCE7' : '#FEF2F2'} strokeWidth="12" />
          <circle cx="70" cy="70" r="58" fill="none"
            stroke={ringColor} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`}
            style={{ transition: 'stroke-dasharray .8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {isProfit ? (
            <>
              <div className="text-2xl font-extrabold text-emerald-600">已回本</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">✓ 獲利中</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-extrabold" style={{ color: ringColor }}>{pct}%</div>
              <div className="text-[10px] text-stone-400 mt-0.5">
                {techMode ? '解套進度' : '已走了這麼多'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 三欄數據 */}
      <div className="grid grid-cols-3 gap-2 mt-3 w-full">
        {[
          { label: techMode ? '加權平均成本' : '我的買價',    val: String(avgCost) },
          { label: techMode ? '現價'          : '現在股價',   val: String(price.toFixed(2)), color: isProfit ? 'text-emerald-600' : 'text-red-500' },
          { label: techMode ? '距解套'        : '還差多少',   val: isProfit ? '0%' : `+${distanceToBreakeven.toFixed(1)}%`, color: isProfit ? 'text-emerald-600' : 'text-amber-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center p-2 bg-stone-50 rounded-xl">
            <div className="text-[9px] text-stone-400 mb-0.5">{label}</div>
            <div className={`text-sm font-bold ${color ?? 'text-stone-700'}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* 白話說明 */}
      <div className="mt-3 w-full px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 leading-relaxed text-center">
        {techMode
          ? `距解套 +${distanceToBreakeven.toFixed(1)}%（+${((avgCost - price)).toFixed(2)}元）。回本目標：${avgCost}`
          : unstuck.summary
        }
      </div>
    </div>
  )
}

function BarProgress({ stats }: { stats: HoldingStats }) {
  const { techMode } = useUIStore()
  const { avgCost, currentShares, distanceToBreakeven, isProfit, currentValue, unrealizedPnL } = stats
  const price = currentShares > 0 ? currentValue / currentShares : 0

  const low  = Math.min(price, avgCost) * 0.90
  const high = Math.max(price, avgCost) * 1.10
  const range = high - low || 1
  const pricePct = ((price - low) / range) * 100
  const costPct  = ((avgCost - low) / range) * 100
  const barColor = isProfit ? '#16A34A' : '#F59E0B'
  const totalGapAmt = Math.abs(Math.round((avgCost - price) * currentShares))

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between text-xs mb-3">
        <span className="text-stone-500 font-medium">
          {techMode ? '解套進度' : '距離回本還有多遠'}
        </span>
        <span className="font-bold" style={{ color: barColor }}>
          {isProfit ? '已回本 ✓' : `還差 ${distanceToBreakeven.toFixed(1)}%`}
        </span>
      </div>

      {/* 進度條 */}
      <div className="relative h-5 bg-stone-100 rounded-full overflow-visible mb-1"
        style={{ marginTop: 28 }}>
        <div className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${Math.max(pricePct, 2)}%`, background: barColor, opacity: .85 }} />
        {/* 現價點 */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${Math.max(Math.min(pricePct, 97), 3)}%` }}>
          <div className="w-4 h-4 rounded-full bg-white border-2 shadow"
            style={{ borderColor: barColor }} />
        </div>
        {/* 成本標記 */}
        <div className="absolute -translate-x-1/2 z-10"
          style={{ left: `${Math.max(Math.min(costPct, 96), 4)}%`, top: -22 }}>
          <div className="text-[10px] text-stone-500 whitespace-nowrap font-medium">
            ▼ {techMode ? '成本' : '回本'} {avgCost}
          </div>
        </div>
        {/* 現價標 */}
        <div className="absolute -translate-x-1/2 z-10"
          style={{ left: `${Math.max(Math.min(pricePct, 96), 4)}%`, bottom: -18 }}>
          <div className="text-[10px] whitespace-nowrap font-medium" style={{ color: barColor }}>
            {techMode ? '現價' : '現在'} {price.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 數據格 */}
      <div className="grid grid-cols-2 gap-2 mt-8">
        {[
          { label: techMode ? '加權平均成本' : '我的買進成本',   val: String(avgCost),   cls: 'bg-stone-50 border-stone-100', vc: 'text-stone-700' },
          { label: techMode ? '現價'          : '目前股價',       val: String(price.toFixed(2)), cls: 'bg-red-50 border-red-100', vc: isProfit ? 'text-emerald-600' : 'text-red-600' },
          { label: techMode ? '未實現損益金額' : '目前虧損金額',  val: isProfit ? `+$${fmt(Math.abs(unrealizedPnL))}` : `-$${fmt(totalGapAmt)}`, cls: 'bg-stone-50 border-stone-100', vc: isProfit ? 'text-emerald-600' : 'text-red-600' },
          { label: techMode ? '回本目標'       : '回本目標價',    val: String(avgCost),   cls: 'bg-amber-50 border-amber-100', vc: 'text-amber-700' },
        ].map(({ label, val, cls, vc }) => (
          <div key={label} className={`p-2.5 rounded-xl border text-center ${cls}`}>
            <div className="text-[10px] text-stone-400 mb-0.5">{label}</div>
            <div className={`text-sm font-bold ${vc}`}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UnstuckProgress({ stats, defaultView = 'ring' }: Props) {
  const [view, setView] = useState<'ring' | 'bar'>(defaultView)
  const { techMode }    = useUIStore()

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-100">
        <span className="text-xs font-bold text-stone-600">
          {techMode ? '解套進度分析' : '📊 距離回本還有多遠？'}
        </span>
        <div className="flex bg-stone-200 rounded-lg p-0.5 gap-0.5">
          {(['ring', 'bar'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                view === v ? 'bg-white text-stone-700 shadow-sm' : 'text-stone-500'
              }`}
            >
              {v === 'ring' ? '⊙ 圓形' : '▬ 條形'}
            </button>
          ))}
        </div>
      </div>
      {view === 'ring' ? <RingProgress stats={stats} /> : <BarProgress stats={stats} />}
    </div>
  )
}
