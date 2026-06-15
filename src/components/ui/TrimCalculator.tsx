'use client'
import { useState } from 'react'
import type { HoldingStats } from '@/types'
import { useSettingsStore } from '@/stores'

interface Props { stats: HoldingStats; currentPrice: number }

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

export default function TrimCalculator({ stats, currentPrice }: Props) {
  const { trimRules } = useSettingsStore()
  const [basis, setBasis] = useState<'shares' | 'value'>('shares')
  const [customPct, setCustomPct] = useState<number | null>(null)

  const SCENARIOS = [
    { key: 'near',   label: '接近賣點區',  pct: trimRules.near_resist,   color: 'bg-amber-50 border-amber-200 text-amber-700' },
    { key: 'in',     label: '進入賣點區',  pct: trimRules.in_resist,     color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { key: 'fail',   label: '突破失敗',    pct: trimRules.fail_breakout, color: 'bg-red-50 border-red-200 text-red-700' },
    { key: 'breach', label: '跌破買點區',  pct: trimRules.break_support, color: 'bg-red-100 border-red-300 text-red-800' },
  ] as const

  // 現在 stats.currentValue 可能為 null，用 currentPrice prop 計算
  function calc(pct: number) {
    let sellShares: number
    if (basis === 'shares') {
      sellShares = Math.floor(stats.currentShares * pct)
    } else {
      const totalVal = stats.currentShares * currentPrice
      sellShares = Math.floor((totalVal * pct) / currentPrice)
    }
    sellShares = Math.min(sellShares, stats.currentShares)
    const remain  = stats.currentShares - sellShares
    const recover = Math.round(sellShares * currentPrice)
    const remainVal = Math.round(remain * currentPrice)
    return { sellShares, lots: Math.floor(sellShares / 1000), remain, recover, remainVal }
  }

  const activePct = customPct ?? SCENARIOS[1].pct
  const custom    = calc(activePct)

  return (
    <div className="space-y-3">
      {/* 基準切換 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-stone-400">計算基準：</span>
        {(['shares', 'value'] as const).map(b => (
          <button key={b} onClick={() => setBasis(b)}
            className={`px-3 py-1 rounded-full border font-medium transition-all ${
              basis === b
                ? 'bg-amber-400 text-white border-amber-400'
                : 'bg-white text-stone-500 border-stone-200'
            }`}
          >{b === 'shares' ? '依股數' : '依市值'}</button>
        ))}
      </div>

      {/* 四情境 */}
      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map(s => {
          const d = calc(s.pct)
          return (
            <div key={s.key} className={`p-3 rounded-xl border ${s.color}`}>
              <div className="text-[10px] font-bold mb-1">{s.label}</div>
              <div className="text-xs mb-1.5">減碼 {Math.round(s.pct * 100)}%</div>
              <div className="text-sm font-bold">賣 {fmt(d.sellShares)} 股</div>
              <div className="text-[10px] mt-0.5 opacity-75">
                回收 ${fmt(d.recover)}｜剩 {fmt(d.remain)} 股
              </div>
            </div>
          )
        })}
      </div>

      {/* 手動試算 */}
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-stone-600">自訂減碼比例</span>
          <span className="text-sm font-bold text-stone-800">{Math.round(activePct * 100)}%</span>
        </div>
        <input type="range" min="5" max="100" step="5"
          value={Math.round(activePct * 100)}
          onChange={e => setCustomPct(parseInt(e.target.value) / 100)}
          className="w-full accent-amber-400"
        />
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {[
            ['賣出股數', `${fmt(custom.sellShares)} 股`],
            ['回收資金', `$${fmt(custom.recover)}`],
            ['剩餘持股', `${fmt(custom.remain)} 股`],
          ].map(([l, v]) => (
            <div key={l} className="bg-white rounded-lg p-2 border border-stone-100">
              <div className="text-[10px] text-stone-400">{l}</div>
              <div className="text-sm font-bold text-stone-700">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
