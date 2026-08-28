'use client'

import { useState } from 'react'
import type { HoldingStats, InstrumentType } from '@/types'
import { useSettingsStore } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { calcSellProfit } from '@/lib/fee-calculator'

interface Props {
  stats: HoldingStats
  currentPrice: number
  resistLevel1?: number | null   // 第一壓力下緣（接近/進入賣點區目標）
  resistLevel2?: number | null   // 第二壓力下緣（突破失敗目標）
  supportLevel1?: number | null  // 第一支撐上緣（跌破目標）
  stopLoss?: number | null       // 後端建議停損價（跌破買點區的備援來源）
  instrumentType?: InstrumentType // 股票或 ETF，決定證交稅率；缺省視為股票
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const round1 = (n: number) => Math.round(n * 100) / 100

/**
 * 目標價格外推邏輯：
 * 後端 resistance_levels / support_levels 不一定總是有兩筆（常見只有 0~1 筆），
 * 因此這裡用「現有已知價位」彼此互相外推，確保四個情境都能顯示合理目標價，
 * 而非在資料缺漏時顯示「無對應價位」。
 *
 * 外推規則（皆基於現價 currentPrice 與已知的有效價位）：
 *   1. 若 resistLevel1 存在 → 直接用
 *      否則 → 用現價 × 1.05（距現價 +5%，估算的第一賣點）
 *   2. 若 resistLevel2 存在 → 直接用
 *      否則 → 用 resistLevel1（若存在）× 1.03，或現價 × 1.08
 *   3. 若 supportLevel1 存在 → 直接用
 *      否則 → 用 stopLoss（若存在）× 1.02，或現價 × 0.95
 *   4. 跌破買點區的目標 → 優先用 stopLoss，其次用 supportLevel1 × 0.98，
 *      最後用現價 × 0.93
 */
function deriveTargets(
  currentPrice: number,
  resistLevel1?: number | null,
  resistLevel2?: number | null,
  supportLevel1?: number | null,
  stopLoss?: number | null,
) {
  // 第一壓力：有則用，否則用現價外推
  const r1 = resistLevel1 ?? round1(currentPrice * 1.05)

  // 第二壓力：有則用；否則以 r1 為基礎外推，若 r1 本身也是外推值則再加碼
  const r2 = resistLevel2 ?? round1(r1 * 1.03)

  // 第一支撐：有則用，否則嘗試用 stopLoss 反推，最後用現價外推
  const s1 = supportLevel1 ?? (stopLoss ? round1(stopLoss * 1.02) : round1(currentPrice * 0.95))

  // 跌破買點區（停損目標）：優先用後端 stopLoss，其次用 s1 外推，最後現價外推
  const breach = stopLoss ?? (supportLevel1 ? round1(supportLevel1 * 0.98) : round1(currentPrice * 0.93))

  return { r1, r2, s1, breach }
}

export default function TrimCalculator({
  stats,
  currentPrice,
  resistLevel1 = null,
  resistLevel2 = null,
  supportLevel1 = null,
  stopLoss = null,
  instrumentType = 'stock',
}: Props) {
  const { trimRules } = useSettingsStore()
  const { techMode }  = useUIStore()

  const targets = deriveTargets(currentPrice, resistLevel1, resistLevel2, supportLevel1, stopLoss)
  // 是否為「真實分析值」還是「外推估算值」，供 UI 標示
  const isEstimated = {
    r1:     resistLevel1  === null || resistLevel1  === undefined,
    r2:     resistLevel2  === null || resistLevel2  === undefined,
    s1:     supportLevel1 === null || supportLevel1 === undefined,
    breach: stopLoss      === null || stopLoss      === undefined,
  }

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

  // ── 四個情境（永遠有目標價，來自實際分析或合理外推）──────
  const SCENARIOS = [
    {
      key:         'near',
      label:       '接近賣點區',
      desc:        techMode ? '距壓力 ≤3%' : '股價快到高點了',
      pct:         trimRules.near_resist,
      targetLabel: `${targets.r1} 元附近`,
      estimated:   isEstimated.r1,
      color:       'border-nb-orange/30 bg-nb-orange-bg',
      labelCls:    'text-amber-700',
      badgeCls:    'bg-nb-orange-bg text-amber-700',
    },
    {
      key:         'in',
      label:       '進入賣點區',
      desc:        techMode ? '已進入壓力區' : '股價已到高點',
      pct:         trimRules.in_resist,
      targetLabel: `${targets.r1} 元以上`,
      estimated:   isEstimated.r1,
      color:       'border-orange-200 bg-orange-50',
      labelCls:    'text-orange-700',
      badgeCls:    'bg-orange-100 text-orange-700',
    },
    {
      key:         'fail',
      label:       '突破失敗',
      desc:        techMode ? '衝高後回跌' : '漲上去又跌回來',
      pct:         trimRules.fail_breakout,
      targetLabel: `${targets.r2} 元回落`,
      estimated:   isEstimated.r2,
      color:       'border-red-200 bg-red-50',
      labelCls:    'text-red-700',
      badgeCls:    'bg-red-100 text-red-700',
    },
    {
      key:         'breach',
      label:       '跌破買點區',
      desc:        techMode ? '跌破支撐，停損' : '跌到該賣的地方',
      pct:         trimRules.break_support,
      targetLabel: `${targets.breach} 元以下`,
      estimated:   isEstimated.breach,
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
        <span className="text-xs text-nb-t2">計算基準：</span>
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
                  ? 'bg-nb-orange text-white border-nb-orange shadow-nb'
                  : 'bg-nb-s0 text-nb-t2 border-nb-border2 hover:border-nb-orange/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {basis === 'value' && (
          <span className="text-[10px] text-nb-t2">
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
              <div className="text-[10px] text-nb-t2 mb-2">{s.desc}</div>

              {/* 目標價格（永遠顯示；若為外推估算值，加註小提示） */}
              <div className={`text-[10px] font-bold px-2 py-1 rounded-lg mb-2 inline-flex items-center gap-1 ${s.badgeCls}`}>
                <span>📌</span>
                <span>{s.targetLabel}</span>
                {s.estimated && <span className="opacity-60">（估）</span>}
              </div>

              {/* 減碼比例 */}
              <div className="text-[10px] text-nb-t2 mb-1.5">
                減碼 {Math.round(s.pct * 100)}%
              </div>

              {/* 依 basis 顯示不同內容 */}
              {basis === 'shares' ? (
                <>
                  <div className="text-base font-extrabold text-nb-t0">
                    賣 {fmt(d.sellShares)} 股
                  </div>
                  <div className="text-[10px] text-nb-t2 mt-1">
                    回收 ${fmt(d.recover)}
                  </div>
                  <div className="text-[10px] text-nb-t2">
                    剩 {fmt(d.remain)} 股
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] text-nb-t2 mb-0.5">賣出金額</div>
                  <div className="text-base font-extrabold text-nb-t0">
                    ${fmt(d.recover)}
                  </div>
                  <div className="text-[10px] text-nb-t2 mt-1">
                    約 {fmt(d.sellShares)} 股
                  </div>
                  <div className="text-[10px] text-nb-t2">
                    剩餘市值 ${fmt(d.remainVal)}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 自訂比例滑桿 ── */}
      <div className="bg-nb-s4 rounded-2xl border border-nb-border2 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-nb-t1">自訂比例試算</span>
          <span className="text-sm font-extrabold text-nb-t0 tabular-nums">
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
              <div className="bg-nb-s0 rounded-xl p-2.5 border border-nb-border">
                <div className="text-[10px] text-nb-t2 mb-0.5">賣出股數</div>
                <div className="text-sm font-extrabold text-nb-t0">{fmt(custom.sellShares)} 股</div>
              </div>
              <div className="bg-nb-s0 rounded-xl p-2.5 border border-nb-border">
                <div className="text-[10px] text-nb-t2 mb-0.5">預估回收</div>
                <div className="text-sm font-extrabold text-nb-orange">${fmt(custom.recover)}</div>
              </div>
              <div className="bg-nb-s0 rounded-xl p-2.5 border border-nb-border">
                <div className="text-[10px] text-nb-t2 mb-0.5">剩餘股數</div>
                <div className="text-sm font-extrabold text-nb-t0">{fmt(custom.remain)} 股</div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-nb-s0 rounded-xl p-2.5 border border-nb-border">
                <div className="text-[10px] text-nb-t2 mb-0.5">賣出金額</div>
                <div className="text-sm font-extrabold text-nb-orange">${fmt(custom.recover)}</div>
              </div>
              <div className="bg-nb-s0 rounded-xl p-2.5 border border-nb-border">
                <div className="text-[10px] text-nb-t2 mb-0.5">約賣幾股</div>
                <div className="text-sm font-extrabold text-nb-t0">{fmt(custom.sellShares)} 股</div>
              </div>
              <div className="bg-nb-s0 rounded-xl p-2.5 border border-nb-border">
                <div className="text-[10px] text-nb-t2 mb-0.5">剩餘市值</div>
                <div className="text-sm font-extrabold text-nb-t0">${fmt(custom.remainVal)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 真實獲利明細（以自訂比例的賣出股數為基準）────────── */}
      {custom.sellShares > 0 && (() => {
        const detail = calcSellProfit(currentPrice, custom.sellShares, stats.avgCost, instrumentType)
        const isProfit = detail.realProfit >= 0
        return (
          <div className="bg-nb-s0 rounded-2xl border border-nb-border2 overflow-hidden">
            <div className="px-4 py-2.5 bg-nb-s4 border-b border-nb-border flex items-center justify-between">
              <span className="text-xs font-bold text-nb-t1">
                {techMode ? '真實獲利明細' : '實際到手金額試算'}
              </span>
              <span className="text-[10px] text-nb-t2">
                {instrumentType === 'etf' ? 'ETF 證交稅 1‰' : '股票證交稅 3‰'}
              </span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {[
                { l: '成交金額',              v: `$${fmt(detail.grossAmount)}`,   cls: 'text-nb-t1' },
                { l: '買進成本（含費）',       v: `$${fmt(detail.buyCostBasis)}`,  cls: 'text-nb-t1' },
                { l: '手續費（1.425‰ × 6折）', v: `-$${fmt(detail.fee)}`,          cls: 'text-nb-t2' },
                { l: '證交稅',                v: `-$${fmt(detail.tax)}`,          cls: 'text-nb-t2' },
              ].map(({ l, v, cls }) => (
                <div key={l} className="flex justify-between text-xs">
                  <span className="text-nb-t2">{l}</span>
                  <span className={`font-semibold ${cls}`}>{v}</span>
                </div>
              ))}
              <div className="h-px bg-nb-s4 my-1" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-nb-t1">
                  {techMode ? '實際回收' : '實際拿到的錢'}
                </span>
                <span className="text-base font-extrabold text-nb-t0">
                  ${fmt(detail.netRecover)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-nb-t1">
                  {techMode ? '實際獲利' : '實際賺/賠多少'}
                </span>
                <span className={`text-base font-extrabold ${isProfit ? 'text-nb-up' : 'text-nb-down'}`}>
                  {isProfit ? '+' : ''}{fmt(detail.realProfit)}
                </span>
              </div>
            </div>
          </div>
        )
      })()}

      <p className="text-[10px] text-nb-t3 text-center leading-relaxed">
        以上試算供參考，實際執行請依市場情況判斷。
      </p>
    </div>
  )
}
