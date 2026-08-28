'use client'

import { useState } from 'react'
import type { HoldingStats } from '@/types'

interface Props {
  stats: HoldingStats
  defaultView?: 'ring' | 'bar'
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

// ── 圓形進度環 ───────────────────────────────────────────────
function RingProgress({ stats }: { stats: HoldingStats }) {
  const price    = stats.currentPrice
  const avgCost  = stats.avgCost
  const shares   = stats.currentShares
  const isProfit = stats.isProfit ?? false

  // price 一定非 null（呼叫方已確保）
  const px = price!

  const C = 2 * Math.PI * 52

  // 進度：以「現價在 [成本×0.85, 成本] 區間」計算百分比
  const low  = avgCost * 0.85
  const pct  = isProfit
    ? 100
    : Math.max(0, Math.min(99, ((px - low) / (avgCost - low)) * 100))

  const ringColor = isProfit ? '#16A34A' : pct > 60 ? '#F59E0B' : '#EF4444'
  const bgColor   = isProfit ? '#DCFCE7' : '#FEF2F2'
  const filled    = (pct / 100) * C

  const distPct = stats.distanceToBreakeven
  const gapAmt  = avgCost - px
  const totalGap = Math.round(gapAmt * shares)

  return (
    <div className="flex flex-col items-center py-2">
      {/* SVG 環 */}
      <div className="relative" style={{ width: 128, height: 128 }}>
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke={bgColor} strokeWidth="10" />
          <circle cx="60" cy="60" r="52" fill="none"
            stroke={ringColor} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${C - filled}`}
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isProfit ? (
            <>
              <span className="text-xl font-bold text-nb-down">已解套</span>
              <span className="text-xs text-nb-down">✓</span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold" style={{ color: ringColor }}>
                {pct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-nb-t2">解套進度</span>
            </>
          )}
        </div>
      </div>

      {/* 四欄數據 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2 w-full max-w-xs">
        {[
          { label: '平均成本', val: String(avgCost),          cls: 'text-nb-t1' },
          { label: '現價',     val: String(px.toFixed(2)),    cls: isProfit ? 'text-nb-down' : 'text-nb-up' },
          { label: '解套價差', val: isProfit ? '已超過成本'  : `-${fmt(totalGap)} 元`, cls: 'text-nb-t2' },
          { label: '距離解套', val: isProfit ? '0%'           : `+${distPct?.toFixed(1) ?? '—'}%`, cls: isProfit ? 'text-nb-down' : 'text-nb-orange' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] text-nb-t2">{label}</div>
            <div className={`text-xs font-semibold ${cls}`}>{val}</div>
          </div>
        ))}
      </div>

      {!isProfit && (
        <div className="mt-2 px-3 py-1.5 bg-nb-orange-bg rounded-xl text-xs text-center w-full">
          <span className="text-nb-orange">解套目標：</span>
          <span className="font-bold text-amber-700 ml-1">{avgCost}</span>
          <span className="text-nb-orange ml-1">（需漲 {distPct?.toFixed(1) ?? '—'}%）</span>
        </div>
      )}
    </div>
  )
}

// ── 橫向進度條 ───────────────────────────────────────────────
function BarProgress({ stats }: { stats: HoldingStats }) {
  const price   = stats.currentPrice!
  const avgCost = stats.avgCost
  const shares  = stats.currentShares
  const isProfit = stats.isProfit ?? false

  const low   = Math.min(price, avgCost) * 0.90
  const high  = Math.max(price, avgCost) * 1.10
  const range = high - low
  const pricePct = range > 0 ? ((price   - low) / range) * 100 : 0
  const costPct  = range > 0 ? ((avgCost - low) / range) * 100 : 0
  const fillPct  = Math.min(pricePct, costPct)
  const barColor = isProfit ? '#16A34A' : '#EF4444'
  const totalGap = Math.round((avgCost - price) * shares)
  const distPct  = stats.distanceToBreakeven

  return (
    <div className="px-1 py-2">
      <div className="flex justify-between text-xs text-nb-t2 mb-3">
        <span>解套進度</span>
        <span className={isProfit ? 'text-nb-down font-medium' : 'text-nb-orange font-medium'}>
          {isProfit ? '已解套 ✓' : `距解套 ${distPct?.toFixed(1) ?? '—'}%`}
        </span>
      </div>

      <div className="relative h-5 bg-nb-s4 rounded-full overflow-visible mb-1">
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(fillPct, 2)}%`, background: barColor, opacity: 0.8 }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${Math.max(Math.min(pricePct, 97), 3)}%` }}>
          <div className="w-3.5 h-3.5 rounded-full bg-nb-s0 border-2 shadow"
            style={{ borderColor: barColor }} />
        </div>
        <div className="absolute top-[-8px] -translate-x-1/2 z-10"
          style={{ left: `${Math.max(Math.min(costPct, 97), 3)}%` }}>
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-stone-400" />
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-nb-t2 mt-3 mb-3">
        <span>{low.toFixed(1)}</span>
        <span className="text-nb-t2 font-medium">←── 區間 ──→</span>
        <span>{high.toFixed(1)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '平均成本',     val: String(avgCost),         highlight: false },
          { label: '現價',         val: String(price.toFixed(2)), highlight: !isProfit },
          { label: '解套價差',
            val: isProfit ? '已超過成本' : `-${fmt(Math.abs(totalGap))} 元`,
            highlight: false },
          { label: '解套目標價',   val: String(avgCost),          highlight: true },
        ].map(({ label, val, highlight }) => (
          <div key={label} className={`p-2.5 rounded-xl text-center border ${
            highlight ? 'bg-nb-orange-bg border-nb-orange/20' : 'bg-nb-s4 border-nb-border'
          }`}>
            <div className="text-[10px] text-nb-t2 mb-0.5">{label}</div>
            <div className={`text-sm font-semibold ${
              highlight ? 'text-amber-700'
              : label === '現價' && !isProfit ? 'text-nb-up'
              : 'text-nb-t1'
            }`}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 主元件 ───────────────────────────────────────────────────
export default function UnstuckProgress({ stats, defaultView = 'ring' }: Props) {
  const [view, setView] = useState<'ring' | 'bar'>(defaultView)

  // 若現價尚未取得，不顯示進度環
  if (stats.currentPrice === null) {
    return (
      <div className="bg-nb-s0 rounded-2xl border border-nb-border2 p-4 text-center text-xs text-nb-t2">
        正在取得最新價格…
      </div>
    )
  }

  return (
    <div className="bg-nb-s0 rounded-2xl border border-nb-border2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-nb-s4 border-b border-nb-border">
        <span className="text-xs font-semibold text-nb-t1">解套進度</span>
        <div className="flex bg-nb-border rounded-lg p-0.5 gap-0.5">
          {(['ring', 'bar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                view === v ? 'bg-nb-s0 text-nb-t1 shadow-nb' : 'text-nb-t2'
              }`}
            >
              {v === 'ring' ? '⊙ 環形' : '▬ 條形'}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-3">
        {view === 'ring' ? <RingProgress stats={stats} /> : <BarProgress stats={stats} />}
      </div>
    </div>
  )
}
