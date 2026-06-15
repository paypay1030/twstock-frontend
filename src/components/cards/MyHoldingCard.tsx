'use client'
import type { HoldingStats } from '@/types'
import UnstuckProgress from '@/components/ui/UnstuckProgress'

interface Props {
  stats: HoldingStats
  currentPrice: number   // 從呼叫方傳入已確認的現價
  compact?: boolean
}

const fmt    = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const pnlCls = (n: number | null) =>
  n === null ? 'text-stone-400'
  : n > 0    ? 'text-red-500'
  : n < 0    ? 'text-emerald-600'
  : 'text-stone-500'

export default function MyHoldingCard({ stats, currentPrice, compact = false }: Props) {
  if (stats.currentShares === 0 && stats.realizedPnL === 0) return null

  const unrealized    = stats.unrealizedPnL
  const unrealizedPct = stats.unrealizedPnLPct
  const curValue      = stats.currentValue
  const distBE        = stats.distanceToBreakeven
  const isProfit      = stats.isProfit

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* 標題 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-100">
        <span className="text-xs font-semibold text-stone-600">我的持股資訊</span>
        <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
          與技術分析獨立
        </span>
      </div>

      <div className="px-4 py-3">
        {/* 四欄 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
          {[
            { label: '加權平均成本', val: String(stats.avgCost) },
            { label: '最近買進價',   val: stats.latestBuyPrice  != null ? String(stats.latestBuyPrice)  : '—' },
            { label: '目前持股',     val: `${fmt(stats.currentShares)} 股（${Math.floor(stats.currentShares / 1000)} 張）` },
            { label: '最近賣出價',   val: stats.latestSellPrice != null ? String(stats.latestSellPrice) : '—' },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className="text-[10px] text-stone-400 mb-0.5">{label}</div>
              <div className="text-sm font-semibold text-stone-800">{val}</div>
            </div>
          ))}
        </div>

        {/* 損益三欄 */}
        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-stone-100 mb-3">
          <div className="text-center">
            <div className="text-[10px] text-stone-400 mb-0.5">未實現損益</div>
            <div className={`text-sm font-bold ${pnlCls(unrealized)}`}>
              {unrealized === null ? '—'
                : `${unrealized >= 0 ? '+' : ''}${fmt(unrealized)}`}
            </div>
            <div className={`text-[10px] ${pnlCls(unrealizedPct)}`}>
              {unrealizedPct === null ? '—' : fmtPct(unrealizedPct)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-stone-400 mb-0.5">目前市值</div>
            <div className="text-sm font-bold text-stone-700">
              {curValue === null ? '—' : `$${fmt(curValue)}`}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-stone-400 mb-0.5">已實現損益</div>
            <div className={`text-sm font-bold ${pnlCls(stats.realizedPnL)}`}>
              {stats.realizedPnL !== 0
                ? `${stats.realizedPnL >= 0 ? '+' : ''}${fmt(stats.realizedPnL)}`
                : '—'}
            </div>
          </div>
        </div>

        {/* 解套進度或已解套提示 */}
        {!compact && stats.currentShares > 0 && isProfit === false && (
          <UnstuckProgress stats={stats} defaultView="ring" />
        )}
        {compact && stats.currentShares > 0 && isProfit === false && distBE !== null && (
          <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-amber-700 font-medium">距解套</span>
              <span className="text-amber-600 font-bold">+{distBE.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full"
                style={{ width: `${Math.max(0, Math.min(99, 100 - distBE))}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>現價 {currentPrice}</span>
              <span>目標 {stats.avgCost}</span>
            </div>
          </div>
        )}
        {stats.currentShares > 0 && isProfit === true && (
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-xl text-xs">
            <span className="text-emerald-600 font-medium">✓ 持股獲利中</span>
            <span className="text-emerald-500">
              現價 {currentPrice} 高於成本 {stats.avgCost}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
