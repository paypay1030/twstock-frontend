'use client'

import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/ui'
import NbLogo from './NbLogo'

const DAILY_LINES: [string, string][] = [
  ['☀️ 今天市場偏震盪',     '今天不用急，我比較建議耐心等待'],
  ['🌤 等待拉回的好機會',   '今天先觀察，比追高更重要'],
  ['☁️ 方向還不明朗',       '觀察是否有轉機訊號，不要貿然進場'],
  ['✨ 耐心是今天最好的策略', '好的機會需要等待，今天不用急'],
]

export default function NbHeader() {
  const { techMode, toggleTechMode } = useUIStore()
  const [lineIdx, setLineIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setLineIdx(i => (i + 1) % DAILY_LINES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const [mood, tip] = DAILY_LINES[lineIdx]

  return (
    <header className="
      shrink-0 sticky top-0 z-40
      bg-nb-card border-b border-nb-border
      pt-[env(safe-area-inset-top,0px)]
    ">
      {/* ── 第一層：Logo + 模式切換 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nb-border">
        <div className="flex items-center gap-2.5">
          <NbLogo size={30} />
          <div className="flex flex-col">
            <span className="text-[15px] font-extrabold text-nb-t0 tracking-tight leading-none">
              小本本
            </span>
            <span className="text-[10px] text-nb-t3 mt-0.5">你的投資筆記</span>
          </div>
        </div>

        {/* 白話 / 技術 切換 */}
        <div className="flex bg-nb-bg border border-nb-border-2 rounded-full p-0.5 gap-0.5">
          {(['plain', 'tech'] as const).map(m => (
            <button
              key={m}
              onClick={toggleTechMode}
              className={`
                text-[11px] font-extrabold px-3 py-1 rounded-full
                transition-all duration-200
                ${(m === 'tech') === techMode
                  ? 'bg-nb-t0 text-nb-card shadow-sm'
                  : 'text-nb-t2 bg-transparent'}
              `}
            >
              {m === 'plain' ? '白話' : '技術'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 第二層：AI 每日一句 ── */}
      <div className="px-4 py-2.5 flex flex-col gap-0.5">
        <p className="text-[12px] font-extrabold text-nb-t0 leading-snug transition-all duration-500">
          {mood}
        </p>
        <p className="text-[11px] text-nb-t2 leading-relaxed transition-all duration-500">
          {tip}
        </p>
      </div>
    </header>
  )
}
