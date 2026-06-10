'use client'

import type { DecisionCard } from '@/types'
import { useUIStore } from '@/stores/ui'
import { generateAISections } from '@/lib/plain-talk'
import type { HoldingStats } from '@/types'

interface Props {
  card: DecisionCard
  holdingStats?: HoldingStats | null
}

function Section({ label, text, techNote }: {
  label: string; text: string; techNote?: string
}) {
  const { techMode } = useUIStore()
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[11px] font-bold text-sky-600 tracking-wider mb-2">{label}</div>
      <div className="text-sm text-sky-900 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: text }} />
      {!techMode && techNote && (
        <div className="mt-1.5 text-[10px] text-stone-400 italic">{techNote}</div>
      )}
      {techMode && techNote && (
        <div className="mt-1.5 text-[10px] text-sky-400">{techNote}</div>
      )}
    </div>
  )
}

export default function AITranslateCard({ card, holdingStats }: Props) {
  const { techMode } = useUIStore()

  const nearestSupport = card.support_levels[0]?.range_high ?? null
  const nearestResist  = card.resistance_levels[0]?.range_low ?? null
  const hasHolding     = !!holdingStats?.currentShares

  const sections = generateAISections(
    card.signal.color,
    card.risk.level,
    card.name,
    card.price,
    nearestSupport,
    nearestResist,
    card.stop_loss,
    hasHolding,
    holdingStats?.avgCost,
  )

  const techSections = {
    situation: `現價 ${card.price} 位於${nearestSupport ? ` MA/支撐（${nearestSupport}）` : '支撐'}與${nearestResist ? `壓力區（${nearestResist}）` : '壓力'}之間。燈號：${card.signal.label}。Volume Profile 在主要支撐附近有量密集區。`,
    riskExplain: `風險評分 ${card.risk.score.toFixed(0)}/100（${card.risk.label}）。成本距離分項：${card.risk.cost_dist_score} / 支撐距離：${card.risk.support_dist_score} / ATR：${card.risk.atr_score}。`,
    whatToDo: card.reason,
    watchOut: `建議停損位置：${card.stop_loss}（強支撐下緣 ×0.98）。`,
  }

  const data = techMode ? techSections : sections

  return (
    <div className="rounded-2xl overflow-hidden border border-sky-200"
      style={{ background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)' }}>

      {/* 標頭 */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-sky-200/60">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-sm font-bold text-sky-800">
            {techMode ? '技術分析摘要' : 'AI 幫你翻譯成白話'}
          </span>
        </div>
        <span className="text-[10px] text-sky-500">{card.name} {card.stock}</span>
      </div>

      {/* 內容 */}
      <div className="px-4 py-4">
        <Section
          label={techMode ? '📊 技術面分析' : '📌 現在的狀況是？'}
          text={data.situation}
          techNote={techMode ? undefined : `技術術語：${card.signal.label} · ${card.signal.desc}`}
        />
        <div className="h-px bg-sky-200/40 my-3" />
        <Section
          label={techMode ? '⚡ 風險評估' : '💰 風險大嗎？'}
          text={data.riskExplain}
          techNote={techMode ? undefined : `技術術語：${card.risk.label}（${card.risk.score.toFixed(0)}分）`}
        />
        <div className="h-px bg-sky-200/40 my-3" />
        <Section
          label={techMode ? '📋 操作建議' : '📋 我現在該做什麼？'}
          text={data.whatToDo}
        />
        <div className="h-px bg-sky-200/40 my-3" />
        <Section
          label={techMode ? '🔔 停損設定' : '⚠️ 什麼時候要特別注意？'}
          text={data.watchOut}
          techNote={techMode ? undefined : `技術術語：停損 ${card.stop_loss} · 強支撐下緣`}
        />
      </div>

      <div className="px-4 pb-3 text-[10px] text-sky-400 text-center">
        {techMode
          ? '以上為技術分析摘要，不保證走勢。'
          : 'AI 翻譯僅協助理解，非投資建議。所有分析都是機率評估，不保證結果。'}
      </div>
    </div>
  )
}
