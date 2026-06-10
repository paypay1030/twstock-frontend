'use client'

import type { DecisionCard } from '@/types'
import { useUIStore } from '@/stores/ui'
import {
  SIGNAL_PLAIN, ZONE_PLAIN, SR_PLAIN, RISK_PLAIN,
  plainifyTrigger, generateOneLiner,
} from '@/lib/plain-talk'

const SIGNAL_CARD_STYLE: Record<string, string> = {
  green:  'border-emerald-300',
  yellow: 'border-amber-300',
  orange: 'border-orange-300',
  red:    'border-red-400',
}
const SIGNAL_HEAD: Record<string, string> = {
  green:  'bg-emerald-50 text-emerald-800',
  yellow: 'bg-amber-50 text-amber-800',
  orange: 'bg-orange-50 text-orange-800',
  red:    'bg-red-50 text-red-800',
}

export default function LazyDecisionCard({
  card,
  hasHolding = false,
}: { card: DecisionCard; hasHolding?: boolean }) {
  const { techMode } = useUIStore()
  const color = card.signal.color
  const sp    = SIGNAL_PLAIN[color]
  const rp    = RISK_PLAIN[card.risk.level]

  const nearestSupport = card.support_levels[0]?.range_high ?? null
  const nearestResist  = card.resistance_levels[0]?.range_low ?? null

  const oneLiner = generateOneLiner(
    color, hasHolding, card.name, card.price,
    nearestSupport, nearestResist,
  )

  return (
    <div className={`rounded-2xl border-2 ${SIGNAL_CARD_STYLE[color]} overflow-hidden`}>

      {/* 標頭 */}
      <div className={`px-4 py-3 flex justify-between items-center ${SIGNAL_HEAD[color]}`}>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-base">{sp.emoji}</span>
          <span>{card.name}</span>
          <span className="text-xs font-medium px-2 py-0.5 bg-white/50 rounded-full">
            {techMode ? sp.techLabel : sp.badge}
          </span>
        </div>
        <div className={`text-xs font-medium ${rp.color}`}>
          {techMode ? `${rp.techLabel}（${card.risk.score.toFixed(0)}）` : rp.label}
        </div>
      </div>

      {/* 本體 */}
      <div className="p-4 bg-white space-y-4">

        {/* 一句話決策 */}
        <div className="pb-4 border-b border-stone-100">
          <div className="text-[11px] text-stone-400 font-medium mb-2 tracking-wide">
            {techMode ? '目前建議' : '📌 現在該怎麼做？'}
          </div>
          <div className="flex justify-between items-start gap-3 mb-2">
            <div className="text-[22px] font-extrabold text-stone-800 leading-tight flex-1">
              {techMode ? card.main_action : oneLiner.action}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] text-stone-400">現價</div>
              <div className="text-xl font-bold text-stone-800">{card.price}</div>
            </div>
          </div>
          <div className="text-sm text-stone-500 leading-relaxed">
            {techMode ? card.reason : oneLiner.reason}
          </div>
          {!techMode && (
            <div className="mt-2 text-[10px] text-stone-400 bg-stone-50 rounded-lg px-2 py-1 inline-block">
              {oneLiner.techHint}
            </div>
          )}
        </div>

        {/* 買點區 / 賣點區 */}
        <div>
          <div className="text-[11px] text-stone-400 font-medium mb-2 tracking-wide">
            {techMode ? '支撐 / 壓力區間' : '💡 價格參考區間'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {card.support_levels.map((s) => (
              <div key={s.rank} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="text-[10px] font-bold text-emerald-600 mb-1">
                  {techMode
                    ? s.label
                    : SR_PLAIN.support.label(s.rank, s.strength === 'strong')}
                </div>
                <div className="text-sm font-bold text-emerald-700">
                  {s.range_low} ～ {s.range_high}
                </div>
                <div className="text-[10px] text-stone-400 mt-1">
                  {techMode
                    ? `強度 ${s.score.toFixed(0)}｜${s.sources.join(', ')}`
                    : SR_PLAIN.support.desc}
                </div>
              </div>
            ))}
            {card.resistance_levels.map((r) => (
              <div key={r.rank} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <div className="text-[10px] font-bold text-red-600 mb-1">
                  {techMode
                    ? r.label
                    : SR_PLAIN.resistance.label(r.rank, r.strength === 'strong')}
                </div>
                <div className="text-sm font-bold text-red-700">
                  {r.range_low} ～ {r.range_high}
                </div>
                <div className="text-[10px] text-stone-400 mt-1">
                  {techMode
                    ? `強度 ${r.score.toFixed(0)}｜${r.sources.join(', ')}`
                    : SR_PLAIN.resistance.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 觸發條件 */}
        <div>
          <div className="text-[11px] text-stone-400 font-medium mb-2 tracking-wide">
            {techMode ? '價格觸發條件' : '🔔 記住這幾個關鍵價格'}
          </div>
          <div className="space-y-1.5">
            {card.triggers.map((t, i) => {
              const { plainCondition, plainAction } = plainifyTrigger(t.condition, t.action)
              const isDanger = t.action.includes('停損')
              return (
                <div key={i}
                  className={`flex justify-between items-center px-3 py-2 rounded-xl text-sm ${
                    isDanger ? 'bg-red-50' : 'bg-stone-50'
                  }`}
                >
                  <span className="font-semibold text-stone-700">{plainCondition}</span>
                  <span className={`font-medium text-right ml-2 text-xs ${
                    isDanger ? 'text-red-600 font-bold' : 'text-stone-600'
                  }`}>
                    {techMode ? t.action : plainAction}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 停損 */}
        <div className="flex justify-between items-center px-4 py-3 bg-orange-50 rounded-xl border border-orange-100">
          <div>
            <div className="text-xs font-bold text-orange-700">
              {techMode ? SR_PLAIN.stopLoss.techLabel : SR_PLAIN.stopLoss.label}
            </div>
            {!techMode && (
              <div className="text-[10px] text-stone-400 mt-0.5">{SR_PLAIN.stopLoss.desc}</div>
            )}
          </div>
          <div className="text-xl font-extrabold text-orange-700">{card.stop_loss}</div>
        </div>

        {/* 風險說明 */}
        <div className={`px-3 py-2.5 rounded-xl border text-xs ${rp.bg}`}>
          <span className={`font-bold ${rp.color}`}>{rp.label}｜</span>
          <span className="text-stone-500">{rp.desc}</span>
        </div>

        {/* 免責 */}
        <div className="text-[10px] text-stone-400 text-center leading-relaxed">
          {techMode
            ? '所有分析均為機率與風險評估，不保證股價走勢。'
            : '⚠️ 以上只是參考，不是保證。股票有風險，最終請自行判斷。'}
        </div>
      </div>
    </div>
  )
}
