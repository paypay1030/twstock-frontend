'use client'
import Link from 'next/link'
import { useMemo } from 'react'
import { useTradeStore, calcHoldingStats } from '@/stores'
import { useUIStore } from '@/stores/ui'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const pnlCls = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-emerald-600' : 'text-stone-500'

export default function HomePage() {
  const { trades } = useTradeStore()
  const { techMode } = useUIStore()

  const stockList = useMemo(() => {
    const seen = new Set<string>()
    return trades.reduce<{code:string;name:string}[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({code:t.code, name:t.name}) }
      return acc
    }, [])
  }, [trades])

  // 首頁不抓現價，只顯示結構
  const recentTrades = [...trades]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* 歡迎區 */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-stone-800">
            {techMode ? '我的持股管家' : '👋 你好，今天股市怎麼樣？'}
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            {techMode
              ? '協助決策 · 不預測股價 · 所有分析為機率評估'
              : '查詢股票、記錄交易、追蹤持股，讓投資更清晰'}
          </p>
        </div>

        {/* 快速入口 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { href:'/analyze',   emoji:'🔍', title: techMode ? '股票分析' : '查詢股票',  sub: techMode ? '支撐壓力 · 決策卡' : '現在該買還是賣？' },
            { href:'/portfolio', emoji:'📋', title: techMode ? '持股管理' : '我的持股',  sub: techMode ? '損益 · 智慧減碼' : '損益和回本進度' },
            { href:'/trading',   emoji:'⚡', title: techMode ? '短線交易' : '短線操作',  sub: techMode ? 'VWAP · 部位計算' : 'Phase 3 開發中' },
            { href:'/settings',  emoji:'⚙️', title: '設定',  sub: '個人偏好 · 規則' },
          ].map(({ href, emoji, title, sub }) => (
            <Link key={href} href={href}
              className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col gap-1 hover:border-amber-300 transition-colors"
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-sm font-bold text-stone-700">{title}</span>
              <span className="text-xs text-stone-400">{sub}</span>
            </Link>
          ))}
        </div>

        {/* 持股總覽 */}
        {stockList.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-stone-700">
                {techMode ? '我的持股' : '我有哪些股票？'}
              </span>
              <Link href="/portfolio" className="text-xs text-amber-500">查看全部 →</Link>
            </div>
            <div className="space-y-2">
              {stockList.slice(0, 3).map(({ code, name }) => (
                <div key={code} className="flex justify-between items-center py-1.5 border-b border-stone-50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-stone-700">{name}</span>
                    <span className="text-xs text-stone-400 ml-1.5">{code}</span>
                  </div>
                  <Link href="/analyze" className="text-xs text-amber-500 font-medium">查詢 →</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 最近交易 */}
        {recentTrades.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-stone-700">最近的交易</span>
              <Link href="/trades" className="text-xs text-amber-500">全部紀錄 →</Link>
            </div>
            <div className="space-y-2">
              {recentTrades.map(t => (
                <div key={t.id} className="flex justify-between items-center text-sm py-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                      t.type === 'buy' ? 'bg-red-500'
                      : t.type === 'add' ? 'bg-orange-400'
                      : t.type === 'reduce' ? 'bg-teal-500'
                      : 'bg-emerald-600'
                    }`}>
                      {t.type === 'buy' ? '買' : t.type === 'add' ? '加' : t.type === 'reduce' ? '減' : '賣'}
                    </span>
                    <span className="text-stone-700">{t.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-stone-600 font-medium">{t.price} × {fmt(t.shares)} 股</div>
                    <div className="text-xs text-stone-400">{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stockList.length === 0 && recentTrades.length === 0 && (
          <div className="text-center py-10 text-stone-400">
            <div className="text-4xl mb-3">🌱</div>
            <div className="text-sm font-medium mb-1">
              {techMode ? '尚無任何紀錄' : '還沒開始記錄'}
            </div>
            <div className="text-xs">先查詢一支股票，或新增第一筆交易紀錄</div>
            <div className="flex justify-center gap-3 mt-4">
              <Link href="/analyze"
                className="px-4 py-2 bg-amber-400 text-white text-xs font-bold rounded-xl"
              >查詢股票</Link>
              <Link href="/portfolio"
                className="px-4 py-2 bg-stone-200 text-stone-600 text-xs font-bold rounded-xl"
              >新增持股</Link>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-stone-300 mt-6 pb-2">
          所有分析均為機率與風險評估，不保證股價走勢
        </p>
      </div>
    </div>
  )
}
