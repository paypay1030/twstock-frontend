'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { useTradeStore, calcHoldingStats } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { TRADE_META } from '@/types'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const pnlCls = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-emerald-600' : 'text-stone-400'
const pnlSign = (n: number) => n > 0 ? '+' : ''

const TIPS = [
  '接近地板價時買進，接近天花板價時考慮賣出',
  '不確定時，持有比頻繁操作更安全',
  '停損是保護資金的工具，不是失敗',
  '分批買進，降低平均成本風險',
  '上漲時不要追高，耐心等待回跌',
  '每筆交易都記下理由，之後能從中學習',
]

function RotatingTip() {
  const [idx, setIdx] = useState(0)
  const [show, setShow] = useState(true)
  useEffect(() => {
    const id = setInterval(() => {
      setShow(false)
      setTimeout(() => { setIdx(i => (i + 1) % TIPS.length); setShow(true) }, 350)
    }, 5000)
    return () => clearInterval(id)
  }, [])
  return (
    <p className={`text-xs text-amber-700 leading-relaxed transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      💡 {TIPS[idx]}
    </p>
  )
}

export default function HomePage() {
  const { trades } = useTradeStore()
  const { techMode, toggleTechMode } = useUIStore()

  const stockList = useMemo(() => {
    const seen = new Set<string>()
    return trades.reduce<{ code: string; name: string }[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({ code: t.code, name: t.name }) }
      return acc
    }, [])
  }, [trades])

  const recentTrades = useMemo(() =>
    [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4), [trades])

  const totalBuy  = trades.filter(t => t.type === 'buy'  || t.type === 'add').length
  const totalSell = trades.filter(t => t.type === 'sell' || t.type === 'reduce').length
  const isEmpty   = stockList.length === 0 && trades.length === 0

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">

        {/* ══ HERO CARD ══════════════════════════════════════════ */}
        <div className="rounded-3xl overflow-hidden shadow-md">
          {/* 漸層頂部 */}
          <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 px-5 pt-5 pb-5">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-none">
                  我的持股管家
                </h1>
                <p className="text-amber-100 text-xs mt-1.5">
                  {techMode ? '技術分析模式 · 專業術語' : '超白話模式 · 讓投資更清晰'}
                </p>
              </div>
              {/* 模式切換 */}
              <button onClick={toggleTechMode}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                  techMode
                    ? 'bg-stone-800 text-white'
                    : 'bg-white text-amber-600'
                }`}
              >
                <span className="text-sm">{techMode ? '📊' : '💬'}</span>
                <span>{techMode ? '技術' : '白話'}</span>
              </button>
            </div>

            {/* 統計三格 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: techMode ? '持股檔數' : '我的股票', value: stockList.length, icon: '📋' },
                { label: techMode ? '買進次數' : '買進紀錄', value: totalBuy,          icon: '📈' },
                { label: techMode ? '賣出次數' : '賣出紀錄', value: totalSell,         icon: '📉' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-3 text-center">
                  <div className="text-2xl font-extrabold text-white leading-none">{value}</div>
                  <div className="text-[10px] text-amber-100 mt-1">{icon} {label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 今日提示 */}
          <div className="bg-amber-50 border-t border-amber-200 px-5 py-3 flex items-start gap-2">
            <RotatingTip />
          </div>
        </div>

        {/* ══ 快速操作 ══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              href: '/analyze',
              icon: '🔍',
              iconBg: 'bg-amber-50',
              title: techMode ? '股票分析' : '查詢股票',
              sub:   techMode ? '支撐壓力 · 決策卡' : '現在該買還是賣？',
              border: 'hover:border-amber-300',
            },
            {
              href: '/portfolio',
              icon: '📋',
              iconBg: 'bg-emerald-50',
              title: techMode ? '持股管理' : '我的持股',
              sub:   techMode ? '損益 · 智慧減碼' : '損益和回本進度',
              border: 'hover:border-emerald-300',
            },
          ].map(({ href, icon, iconBg, title, sub, border }) => (
            <Link key={href} href={href}
              className={`bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex flex-col gap-2.5 ${border} hover:shadow-md transition-all active:scale-95`}
            >
              <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center text-xl shadow-inner`}>
                {icon}
              </div>
              <div>
                <div className="text-sm font-bold text-stone-800">{title}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ══ 空白引導 ══════════════════════════════════════════ */}
        {isEmpty && (
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-7 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              🌱
            </div>
            <h2 className="text-base font-extrabold text-stone-700 mb-2">
              {techMode ? '尚無任何紀錄' : '還沒開始記錄'}
            </h2>
            <p className="text-xs text-stone-400 mb-5 leading-relaxed">
              {techMode
                ? '先查詢股票進行技術分析，或新增第一筆交易紀錄。'
                : '先查一支股票看看分析結果，或把你買的股票記下來，就能追蹤損益。'}
            </p>
            <div className="flex justify-center gap-2.5">
              <Link href="/analyze"
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">
                查詢股票
              </Link>
              <Link href="/portfolio"
                className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-colors">
                新增持股
              </Link>
            </div>
          </div>
        )}

        {/* ══ 持股快覽 ══════════════════════════════════════════ */}
        {stockList.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-amber-400 rounded-full" />
                <h2 className="text-sm font-bold text-stone-700">
                  {techMode ? '我的持股' : '我有哪些股票？'}
                </h2>
              </div>
              <Link href="/portfolio" className="text-xs text-amber-500 font-semibold hover:text-amber-600">
                全部 →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stockList.slice(0, 4).map(({ code, name }) => {
                const st = calcHoldingStats(code, name, trades.filter(t => t.code === code), 0)
                return (
                  <Link key={code} href={`/analyze?q=${code}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center flex-shrink-0 shadow-inner">
                      <span className="text-xs font-extrabold text-stone-500">
                        {name.slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-stone-800">{name}</span>
                        <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">{code}</span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {fmt(st.currentShares)} 股 · 成本 {st.avgCost}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-stone-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ 最近交易 ══════════════════════════════════════════ */}
        {recentTrades.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-stone-300 rounded-full" />
                <h2 className="text-sm font-bold text-stone-700">最近的交易</h2>
              </div>
              <Link href="/trades" className="text-xs text-amber-500 font-semibold hover:text-amber-600">
                全部紀錄 →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recentTrades.map(t => {
                const meta = TRADE_META[t.type]
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0 shadow-sm ${meta.badgeBg}`}>
                      {meta.short}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-stone-800">{t.name}</span>
                        <span className="text-[10px] text-stone-400">{t.code}</span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {t.price} 元 × {fmt(t.shares)} 股
                        {t.note ? ` · ${t.note}` : ''}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] text-stone-400">{t.date}</div>
                      {t.journal && (
                        <div className="text-sm mt-0.5">
                          {t.journal.confidence === 1 ? '🌱' : t.journal.confidence === 2 ? '🌿' : '🌳'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AI 建議入口卡 */}
        <Link href="/analyze"
          className="block bg-gradient-to-r from-sky-50 to-indigo-50 rounded-2xl border border-sky-200 p-4 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🤖</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-sky-800">
                {techMode ? 'AI 技術分析' : 'AI 幫你翻譯成白話'}
              </div>
              <div className="text-[11px] text-sky-600 mt-0.5">
                {techMode
                  ? '輸入股票代號，取得技術面分析摘要'
                  : '查詢任一股票，AI 用白話告訴你現在該怎麼做'}
              </div>
            </div>
            <svg className="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <p className="text-center text-[10px] text-stone-300 pb-2 leading-relaxed">
          所有分析均為機率與風險評估，不保證股價走勢 · 非投資建議
        </p>
      </div>
    </div>
  )
}
