'use client'

import type { HoldingStats } from '@/types'
import { useUIStore } from '@/stores/ui'

interface Props { stats: HoldingStats; currentPrice: number; compact?: boolean }

const fmt  = (n: number) => n.toLocaleString('zh-TW')
const fmtP = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const pnlC = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-emerald-600' : 'text-stone-500'

export default function MyHoldingCard({ stats, currentPrice, compact = false }: Props) {
  const { techMode } = useUIStore()
  if (stats.currentShares === 0 && stats.realizedPnL === 0) return null

  const labels = techMode
    ? { cost: '加權平均成本', lastBuy: '最近買進價', shares: '持股股數', lastSell: '最近賣出價', unrealized: '未實現損益', value: '目前市值', realized: '已實現損益' }
    : { cost: '我的買進成本', lastBuy: '最近一次買進', shares: '我持有多少股', lastSell: '最近一次賣出', unrealized: '目前損益', value: '股票總值', realized: '賣出後有賺' }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-100">
        <span className="text-xs font-bold text-stone-600">
          {techMode ? '持股資訊' : '我的持股詳細資訊'}
        </span>
        <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
          {techMode ? '與技術分析獨立計算' : '與技術分析無關'}
        </span>
      </div>

      <div className="px-4 py-3">
        {stats.currentShares > 0 && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
              {[
                { label: labels.cost,     val: `${stats.avgCost} 元` },
                { label: labels.lastBuy,  val: stats.latestBuyPrice  != null ? `${stats.latestBuyPrice} 元`  : '—' },
                { label: labels.shares,   val: `${fmt(stats.currentShares)} 股（${Math.floor(stats.currentShares / 1000)} 張）` },
                { label: labels.lastSell, val: stats.latestSellPrice != null ? `${stats.latestSellPrice} 元` : '—' },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="text-[10px] text-stone-400 mb-0.5">{label}</div>
                  <div className="text-sm font-bold text-stone-800">{val}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-stone-100">
              <div className="text-center">
                <div className="text-[10px] text-stone-400 mb-0.5">{labels.unrealized}</div>
                <div className={`text-sm font-bold ${pnlC(stats.unrealizedPnL)}`}>
                  {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}
                </div>
                <div className={`text-[10px] ${pnlC(stats.unrealizedPnLPct)}`}>
                  {fmtP(stats.unrealizedPnLPct)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-stone-400 mb-0.5">{labels.value}</div>
                <div className="text-sm font-bold text-stone-700">${fmt(stats.currentValue)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-stone-400 mb-0.5">
                  {techMode ? '距解套' : '距回本'}
                </div>
                {stats.distanceToBreakeven <= 0 ? (
                  <div className="text-sm font-bold text-emerald-600">已回本 ✓</div>
                ) : (
                  <>
                    <div className="text-sm font-bold text-amber-600">
                      +{stats.distanceToBreakeven.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-stone-400">{stats.avgCost} 元</div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {stats.realizedPnL !== 0 && (
          <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t border-stone-100 text-sm">
            <span className="text-xs text-stone-400">{labels.realized}</span>
            <span className={`font-bold ${pnlC(stats.realizedPnL)}`}>
              {stats.realizedPnL >= 0 ? '+' : ''}{fmt(stats.realizedPnL)} 元
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
