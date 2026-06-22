'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import {
  useTradeStore, useDividendStore, useWatchlistStore, useSettingsStore,
  calcHoldingStats,
} from '@/stores'
import { useUIStore } from '@/stores/ui'
import { getStockBasic } from '@/lib/api'
import { calcRealProfit, calcTotalReturn } from '@/lib/fee-calculator'
import { calcTotalDividendIncome } from '@/lib/dividend-stats'
import { calcTradeStatistics } from '@/lib/trade-stats'
import { TRADE_META } from '@/types'
import type { InstrumentType, HoldingStats } from '@/types'

const fmt    = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtSign = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`
const pnlCls = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-emerald-600' : 'text-stone-400'

type ProfitMode = 'book' | 'real'

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
  const { trades }     = useTradeStore()
  const { dividends }  = useDividendStore()
  const { watchlist }  = useWatchlistStore()
  const { totalFund }  = useSettingsStore()
  const { techMode, toggleTechMode } = useUIStore()
  const [mode, setMode] = useState<ProfitMode>('real')

  // ── 持股清單（從交易紀錄推導）─────────────────────────────
  const stockList = useMemo(() => {
    const seen = new Set<string>()
    const m: Record<string, InstrumentType> = {}
    const list = trades.reduce<{ code: string; name: string }[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({ code: t.code, name: t.name }) }
      if (t.instrumentType) m[t.code] = t.instrumentType
      return acc
    }, [])
    return { list, instrumentTypeMap: m }
  }, [trades])

  // ── 批次自動載入所有持股現價（沿用持股頁驗證過的穩定模式）──
  const [priceMap, setPriceMap]   = useState<Record<string, number>>({})
  const [statusMap, setStatusMap] = useState<Record<string, 'loading' | 'done' | 'error'>>({})

  useEffect(() => {
    for (const { code } of stockList.list) {
      if (statusMap[code] === 'done' || statusMap[code] === 'loading') continue
      setStatusMap(m => ({ ...m, [code]: 'loading' }))
      getStockBasic(code)
        .then(data => {
          if (!data.current_price || data.current_price <= 0) throw new Error('現價無效')
          setPriceMap(m => ({ ...m, [code]: data.current_price }))
          setStatusMap(m => ({ ...m, [code]: 'done' }))
        })
        .catch(() => setStatusMap(m => ({ ...m, [code]: 'error' })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockList.list])

  const allLoaded = stockList.list.length === 0 ||
    stockList.list.every(({ code }) => statusMap[code] === 'done' || statusMap[code] === 'error')

  // ── 每檔持股統計 ──────────────────────────────────────────
  const statsMap = useMemo(() => {
    const m: Record<string, HoldingStats> = {}
    for (const { code, name } of stockList.list) {
      m[code] = calcHoldingStats(code, name, trades, priceMap[code] ?? null)
    }
    return m
  }, [stockList.list, trades, priceMap])

  // ── ① 資產總覽 ────────────────────────────────────────────
  const holdingsValue = useMemo(
    () => Object.values(statsMap).reduce((s, x) => s + (x.currentValue ?? 0), 0),
    [statsMap]
  )
  const investedCost = useMemo(
    () => Object.values(statsMap).reduce((s, x) => s + x.avgCost * x.currentShares, 0),
    [statsMap]
  )
  const cashValue = Math.max(totalFund - holdingsValue, 0)

  // 帳面 vs 實際 未實現損益彙總
  const totalUnrealizedBook = useMemo(
    () => Object.values(statsMap).reduce((s, x) => s + (x.unrealizedPnL ?? 0), 0),
    [statsMap]
  )
  const totalUnrealizedReal = useMemo(() => {
    return Object.values(statsMap).reduce((s, x) => {
      if (x.currentPrice === null || x.currentShares === 0) return s
      const rp = calcRealProfit(x.avgCost, x.currentShares, x.currentPrice, x.instrumentType)
      return s + rp.realPnL
    }, 0)
  }, [statsMap])
  const displayUnrealized = mode === 'book' ? totalUnrealizedBook : totalUnrealizedReal

  const totalRealized = useMemo(
    () => Object.values(statsMap).reduce((s, x) => s + x.realizedPnL, 0),
    [statsMap]
  )

  // ── ② 真正總報酬 ──────────────────────────────────────────
  const dividendIncome = useMemo(() => calcTotalDividendIncome(dividends), [dividends])
  const totalReturn = calcTotalReturn(totalRealized, displayUnrealized, dividendIncome)
  const totalReturnPct = investedCost > 0
    ? Math.round((totalReturn.totalReturn / investedCost) * 10000) / 100
    : 0

  // ── ③ 持股摘要：依燈號/損益排序，列前 3 檔 ──────────────────
  const holdingsSorted = useMemo(() => {
    return [...stockList.list]
      .map(({ code, name }) => ({ code, name, stats: statsMap[code] }))
      .filter(h => h.stats.currentShares > 0)
      .sort((a, b) => {
        // 虧損幅度大的優先顯示（最需要關注）
        const pa = a.stats.unrealizedPnLPct ?? 0
        const pb = b.stats.unrealizedPnLPct ?? 0
        return pa - pb
      })
  }, [stockList.list, statsMap])

  // ── ⑤ 自選股摘要（前 3 檔）──────────────────────────────────
  const watchlistTop = watchlist.slice(0, 3)

  // ── ⑥ 最近交易 ────────────────────────────────────────────
  const recentTrades = useMemo(() =>
    [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4), [trades])

  const isEmpty = stockList.list.length === 0 && trades.length === 0

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">

        {/* ══ HERO + 模式切換 ══════════════════════════════════ */}
        <div className="rounded-3xl overflow-hidden shadow-md">
          <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 px-5 pt-5 pb-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-none">
                  我的持股管家
                </h1>
                <p className="text-amber-100 text-xs mt-1.5">
                  {techMode ? '技術分析模式 · 專業術語' : '超白話模式 · 讓投資更清晰'}
                </p>
              </div>
              <button onClick={toggleTechMode}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm flex-shrink-0 ${
                  techMode ? 'bg-stone-800 text-white' : 'bg-white text-amber-600'
                }`}
              >
                <span className="text-sm">{techMode ? '📊' : '💬'}</span>
                <span>{techMode ? '技術' : '白話'}</span>
              </button>
            </div>

            {/* ① 資產總覽 */}
            {stockList.list.length > 0 ? (
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] text-amber-100 font-bold tracking-wider">
                    {techMode ? '資產總覽' : '我現在有多少錢？'}
                  </span>
                  {!allLoaded && (
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span className="text-[9px] text-amber-100">更新中</span>
                    </div>
                  )}
                </div>
                <div className="text-3xl font-extrabold text-white leading-none mb-1">
                  ${fmt(holdingsValue + cashValue)}
                </div>
                <div className="text-[10px] text-amber-100 mb-3">
                  {techMode ? '總資產（持股市值＋現金）' : '股票加上現金，總共值這麼多'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/20 rounded-xl px-2 py-2 text-center">
                    <div className="text-[9px] text-amber-100 mb-0.5">投入成本</div>
                    <div className="text-xs font-extrabold text-white">${fmt(investedCost)}</div>
                  </div>
                  <div className="bg-white/20 rounded-xl px-2 py-2 text-center">
                    <div className="text-[9px] text-amber-100 mb-0.5">持股市值</div>
                    <div className="text-xs font-extrabold text-white">${fmt(holdingsValue)}</div>
                  </div>
                  <div className="bg-white/20 rounded-xl px-2 py-2 text-center">
                    <div className="text-[9px] text-amber-100 mb-0.5">
                      {totalFund > 0 ? '現金' : '未設定'}
                    </div>
                    <div className="text-xs font-extrabold text-white">
                      {totalFund > 0 ? `$${fmt(cashValue)}` : (
                        <Link href="/settings" className="underline decoration-dotted text-[10px]">設定 →</Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: techMode ? '持股檔數' : '我的股票', value: 0, icon: '📋' },
                  { label: techMode ? '自選股' : '關注清單', value: watchlist.length, icon: '⭐' },
                  { label: techMode ? '交易次數' : '交易紀錄', value: trades.length, icon: '📈' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-3 text-center">
                    <div className="text-2xl font-extrabold text-white leading-none">{value}</div>
                    <div className="text-[10px] text-amber-100 mt-1">{icon} {label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border-t border-amber-200 px-5 py-3">
            <RotatingTip />
          </div>
        </div>

        {/* ══ ② 真正總報酬 ═══════════════════════════════════════ */}
        {stockList.list.length > 0 && (
          <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-stone-400 font-bold tracking-widest">
                {techMode ? '真正總報酬' : '我真正賺了多少？'}
              </span>
              <div className="flex bg-stone-700/50 rounded-lg p-0.5 gap-0.5">
                {(['book', 'real'] as ProfitMode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all ${
                      mode === m ? 'bg-white text-stone-800' : 'text-stone-400'
                    }`}
                  >
                    {m === 'book' ? (techMode ? '帳面' : '帳面金額') : (techMode ? '實際' : '真正到手')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <div className="text-[9px] text-stone-500 mb-1 font-medium">
                  {techMode ? '已實現' : '已落袋'}
                </div>
                <div className={`text-sm font-extrabold leading-tight ${
                  totalRealized >= 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>{fmtSign(totalRealized)}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-stone-500 mb-1 font-medium">
                  {techMode ? '未實現' : '帳上損益'}
                </div>
                <div className={`text-sm font-extrabold leading-tight ${
                  displayUnrealized >= 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>{fmtSign(displayUnrealized)}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-stone-500 mb-1 font-medium">
                  {techMode ? '股息' : '領到股息'}
                </div>
                <div className="text-sm font-extrabold text-emerald-400 leading-tight">
                  +{fmt(dividendIncome)}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-700 flex justify-between items-center">
              <span className="text-xs text-stone-400">
                {mode === 'book' ? '帳面' : '實際'}已實現＋未實現＋股息
              </span>
              <div className="text-right">
                <div className={`text-lg font-extrabold ${
                  totalReturn.totalReturn >= 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {fmtSign(totalReturn.totalReturn)}
                </div>
                {investedCost > 0 && (
                  <div className={`text-[10px] ${totalReturnPct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ 快速操作 ══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/analyze',   icon: '🔍', iconBg: 'bg-amber-50',   title: techMode ? '股票分析' : '查詢股票', sub: techMode ? '支撐壓力 · 決策卡' : '現在該買還是賣？', border: 'hover:border-amber-300' },
            { href: '/portfolio', icon: '📋', iconBg: 'bg-emerald-50', title: techMode ? '持股管理' : '我的持股', sub: techMode ? '損益 · 智慧減碼' : '損益和回本進度', border: 'hover:border-emerald-300' },
          ].map(({ href, icon, iconBg, title, sub, border }) => (
            <Link key={href} href={href}
              className={`bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex flex-col gap-2.5 ${border} hover:shadow-md transition-all active:scale-95`}
            >
              <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center text-xl shadow-inner`}>{icon}</div>
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
            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">🌱</div>
            <h2 className="text-base font-extrabold text-stone-700 mb-2">
              {techMode ? '尚無任何紀錄' : '還沒開始記錄'}
            </h2>
            <p className="text-xs text-stone-400 mb-5 leading-relaxed">
              {techMode ? '先查詢股票進行技術分析，或新增第一筆交易紀錄。' : '先查一支股票看看分析結果，或把你買的股票記下來，就能追蹤損益。'}
            </p>
            <div className="flex justify-center gap-2.5">
              <Link href="/analyze" className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">查詢股票</Link>
              <Link href="/portfolio" className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-colors">新增持股</Link>
            </div>
          </div>
        )}

        {/* ══ ③ 持股摘要 ═══════════════════════════════════════ */}
        {holdingsSorted.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-amber-400 rounded-full" />
                <h2 className="text-sm font-bold text-stone-700">
                  {techMode ? '持股摘要' : '我的股票現況'}
                </h2>
              </div>
              <Link href="/portfolio" className="text-xs text-amber-500 font-semibold hover:text-amber-600">全部 →</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {holdingsSorted.slice(0, 3).map(({ code, name, stats }) => (
                <Link key={code} href={`/analyze?q=${code}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center flex-shrink-0 shadow-inner">
                    <span className="text-xs font-extrabold text-stone-500">{name.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-stone-800">{name}</span>
                      <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">{code}</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      {fmt(stats.currentShares)} 股 · 成本 {stats.avgCost}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {stats.unrealizedPnL !== null ? (
                      <>
                        <div className={`text-xs font-extrabold ${pnlCls(stats.unrealizedPnL)}`}>
                          {fmtSign(stats.unrealizedPnL)}
                        </div>
                        <div className={`text-[10px] ${pnlCls(stats.unrealizedPnLPct ?? 0)}`}>
                          {stats.unrealizedPnLPct !== null ? `${stats.unrealizedPnLPct >= 0 ? '+' : ''}${stats.unrealizedPnLPct.toFixed(1)}%` : ''}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-stone-300">取得中…</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══ ④ 股息收入 ═══════════════════════════════════════ */}
        {dividends.length > 0 && (
          <Link href="/dividends"
            className="block bg-white rounded-2xl border border-stone-100 shadow-sm p-4 hover:border-emerald-200 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xl shadow-inner">💰</div>
                <div>
                  <div className="text-sm font-bold text-stone-800">
                    {techMode ? '股息收入' : '我領到的股息'}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">{dividends.length} 筆紀錄</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-extrabold text-emerald-600">+${fmt(dividendIncome)}</div>
                <div className="text-[10px] text-stone-400">累積</div>
              </div>
            </div>
          </Link>
        )}

        {/* ══ ⑤ 自選股摘要 ═══════════════════════════════════════ */}
        {watchlistTop.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-sky-400 rounded-full" />
                <h2 className="text-sm font-bold text-stone-700">
                  {techMode ? '自選股' : '我關注的股票'}
                </h2>
              </div>
              <Link href="/watchlist" className="text-xs text-amber-500 font-semibold hover:text-amber-600">全部 →</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {watchlistTop.map(w => (
                <Link key={w.id} href={`/analyze?q=${w.code}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-extrabold text-sky-600">{w.name.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-stone-800">{w.name}</span>
                    <span className="text-[10px] text-stone-400 ml-1.5">{w.code}</span>
                  </div>
                  <span className="text-[10px] text-stone-300">{w.addedDate} 加入</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══ ⑥ 最近交易 ═══════════════════════════════════════ */}
        {recentTrades.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-stone-300 rounded-full" />
                <h2 className="text-sm font-bold text-stone-700">
                  {techMode ? '最近交易' : '最近的交易'}
                </h2>
              </div>
              <Link href="/trades" className="text-xs text-amber-500 font-semibold hover:text-amber-600">全部紀錄 →</Link>
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
                        {t.price} 元 × {fmt(t.shares)} 股{t.note ? ` · ${t.note}` : ''}
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
                {techMode ? '輸入股票代號，取得技術面分析摘要' : '查詢任一股票，AI 用白話告訴你現在該怎麼做'}
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
