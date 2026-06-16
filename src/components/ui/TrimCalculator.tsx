'use client'

import { useState } from 'react'
import type { HoldingStats } from '@/types'
import { useSettingsStore } from '@/stores'
import { useUIStore } from '@/stores/ui'

interface Props {
  stats: HoldingStats
  currentPrice: number
  resistLevel1?: number | null   // 第一壓力下緣（接近/進入賣點區目標）
  resistLevel2?: number | null   // 第二壓力下緣（突破失敗目標）
  supportLevel1?: number | null  // 第一支撐上緣（跌破目標）
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

export default function TrimCalculator({
  stats,
  currentPrice,
  resistLevel1 = null,
  resistLevel2 = null,
  supportLevel1 = null,
}: Props) {
  const { trimRules } = useSettingsStore()
  const { techMode }  = useUIStore()

  // ── basis：明確用 useState，切換時強制 re-render ──────────
  const [basis, setBasis] = useState<'shares' | 'value'>('shares')
  const [customPct, setCustomPct] = useState(trimRules.in_resist)

  // ── 核心計算：完全不用 useMemo，確保 basis 切換立即生效 ──
  function calcSell(pct: number): {
    sellShares: number
    lots: number
    remain: number
    recover: number
    remainVal: number
  } {
    let sellShares: number

    if (basis === 'shares') {
      sellShares = Math.floor(stats.currentShares * pct)
    } else {
      // 依市值：算出要賣掉多少錢，再換算成股數
      const totalVal = stats.currentShares * currentPrice
      sellShares     = Math.floor((totalVal * pct) / currentPrice)
    }

    sellShares = Math.min(sellShares, stats.currentShares)
    const remain    = stats.currentShares - sellShares
    const recover   = Math.round(sellShares * currentPrice)
    const remainVal = Math.round(remain * currentPrice)

    return {
      sellShares,
      lots: Math.floor(sellShares / 1000),
      remain,
      recover,
      remainVal,
    }
  }

  // ── 四個情境（純資料，不含計算結果）─────────────────────
  const SCENARIOS = [
    {
      key:         'near',
      label:       '接近賣點區',
      desc:        techMode ? '距壓力 ≤3%' : '股價快到高點了',
      pct:         trimRules.near_resist,
      targetLabel: resistLevel1 ? `${resistLevel1} 元附近` : null,
      color:       'border-amber-200 bg-amber-50',
      labelCls:    'text-amber-700',
      badgeCls:    'bg-amber-100 text-amber-700',
    },
    {
      key:         'in',
      label:       '進入賣點區',
      desc:        techMode ? '已進入壓力區' : '股價已到高點',
      pct:         trimRules.in_resist,
      targetLabel: resistLevel1 ? `${resistLevel1} 元以上` : null,
      color:       'border-orange-200 bg-orange-50',
      labelCls:    'text-orange-700',
      badgeCls:    'bg-orange-100 text-orange-700',
    },
    {
      key:         'fail',
      label:       '突破失敗',
      desc:        techMode ? '衝高後回跌' : '漲上去又跌回來',
      pct:         trimRules.fail_breakout,
      targetLabel: (resistLevel2 ?? resistLevel1)
        ? `${resistLevel2 ?? resistLevel1} 元回落`
        : null,
      color:       'border-red-200 bg-red-50',
      labelCls:    'text-red-700',
      badgeCls:    'bg-red-100 text-red-700',
    },
    {
      key:         'breach',
      label:       '跌破買點區',
      desc:        techMode ? '跌破支撐，停損' : '跌到該賣的地方',
      pct:         trimRules.break_support,
      targetLabel: supportLevel1 ? `${supportLevel1} 元以下` : null,
      color:       'border-red-300 bg-red-100',
      labelCls:    'text-red-800',
      badgeCls:    'bg-red-200 text-red-800',
    },
  ] as const

  const custom = calcSell(customPct)
  const totalVal = stats.currentShares * currentPrice

  return (
    <div className="space-y-3">

      {/* ── 基準切換 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-stone-400">計算基準：</span>
        <div className="flex gap-1.5">
          {([
            { k: 'shares' as const, label: techMode ? '依股數' : '按股數算' },
            { k: 'value'  as const, label: techMode ? '依市值' : '按金額算' },
          ]).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setBasis(k)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                basis === k
                  ? 'bg-amber-400 text-white border-amber-400 shadow-sm'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-amber-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {basis === 'value' && (
          <span className="text-[10px] text-stone-400">
            持股總值 ${fmt(totalVal)}
          </span>
        )}
      </div>

      {/* ── 四情境卡 ── */}
      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map(s => {
          // 在 render 時計算，確保 basis 切換立即反映
          const d = calcSell(s.pct)
          return (
            <div key={s.key} className={`rounded-2xl border p-3 ${s.color}`}>
              {/* 情境標籤 */}
              <div className={`text-[10px] font-extrabold mb-0.5 ${s.labelCls}`}>
                {s.label}
              </div>
              <div className="text-[10px] text-stone-400 mb-2">{s.desc}</div>

              {/* 目標價格 */}
              {s.targetLabel ? (
                <div className={`text-[10px] font-bold px-2 py-1 rounded-lg mb-2 inline-flex items-center gap-1 ${s.badgeCls}`}>
                  <span>📌</span>
                  <span>{s.targetLabel}</span>
                </div>
              ) : (
                <div className="text-[10px] text-stone-300 mb-2 px-1">
                  目標價：取得分析後顯示
                </div>
              )}

              {/* 減碼比例 */}
              <div className="text-[10px] text-stone-500 mb-1.5">
                減碼 {Math.round(s.pct * 100)}%
              </div>

              {/* 依 basis 顯示不同內容 */}
              {basis === 'shares' ? (
                <>
                  <div className="text-base font-extrabold text-stone-900">
                    賣 {fmt(d.sellShares)} 股
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    回收 ${fmt(d.recover)}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    剩 {fmt(d.remain)} 股
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] text-stone-500 mb-0.5">賣出金額</div>
                  <div className="text-base font-extrabold text-stone-900">
                    ${fmt(d.recover)}
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    約 {fmt(d.sellShares)} 股
                  </div>
                  <div className="text-[10px] text-stone-400">
                    剩餘市值 ${fmt(d.remainVal)}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 自訂比例滑桿 ── */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-stone-600">自訂比例試算</span>
          <span className="text-sm font-extrabold text-stone-900 tabular-nums">
            {Math.round(customPct * 100)}%
          </span>
        </div>
        <input
          type="range" min="5" max="100" step="5"
          value={Math.round(customPct * 100)}
          onChange={e => setCustomPct(parseInt(e.target.value) / 100)}
          className="w-full accent-amber-400 mb-3"
        />
        <div className="grid grid-cols-3 gap-2 text-center">
          {basis === 'shares' ? (
            <>
              <div className="bg-white rounded-xl p-2.5 border border-stone-100">
                <div className="text-[10px] text-stone-400 mb-0.5">賣出股數</div>
                <div className="text-sm font-extrabold text-stone-800">{fmt(custom.sellShares)} 股</div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-stone-100">
                <div className="text-[10px] text-stone-400 mb-0.5">預估回收</div>
                <div className="text-sm font-extrabold text-amber-600">${fmt(custom.recover)}</div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-stone-100">
                <div className="text-[10px] text-stone-400 mb-0.5">剩餘股數</div>
                <div className="text-sm font-extrabold text-stone-800">{fmt(custom.remain)} 股</div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl p-2.5 border border-stone-100">
                <div className="text-[10px] text-stone-400 mb-0.5">賣出金額</div>
                <div className="text-sm font-extrabold text-amber-600">${fmt(custom.recover)}</div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-stone-100">
                <div className="text-[10px] text-stone-400 mb-0.5">約賣幾股</div>
                <div className="text-sm font-extrabold text-stone-800">{fmt(custom.sellShares)} 股</div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-stone-100">
                <div className="text-[10px] text-stone-400 mb-0.5">剩餘市值</div>
                <div className="text-sm font-extrabold text-stone-800">${fmt(custom.remainVal)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[10px] text-stone-300 text-center leading-relaxed">
        以上試算供參考，實際執行請依市場情況判斷。
      </p>
    </div>
  )
}
