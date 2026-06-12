'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { analyzeStock, getStockHistory, searchStocks } from '@/lib/api'
import { useTradeStore, calcHoldingStats } from '@/stores'
import { useUIStore } from '@/stores/ui'
import {
  SIGNAL_PLAIN, SR_PLAIN, RISK_PLAIN,
  generateOneLiner, generateAISections,
} from '@/lib/plain-talk'
import type { AnalysisResponse, KLine, SearchResult, SignalColor, SRLevel } from '@/types'
import dynamic from 'next/dynamic'
import MyHoldingCard from '@/components/cards/MyHoldingCard'
import AITranslateCard from '@/components/cards/AITranslateCard'

const StockChart = dynamic(() => import('@/components/charts/StockChart'), { ssr: false })

type Tab = 'card' | 'chart' | 'detail' | 'ai'

// ── 燈號樣式 ─────────────────────────────────────────────────
const SIG: Record<SignalColor, {
  cardBorder: string; headBg: string; headText: string
  badgeBg: string; badgeText: string; accentBar: string
}> = {
  green:  { cardBorder:'border-emerald-300', headBg:'bg-gradient-to-br from-emerald-50 to-teal-50', headText:'text-emerald-800', badgeBg:'bg-emerald-500', badgeText:'text-white', accentBar:'bg-emerald-400' },
  yellow: { cardBorder:'border-amber-300',   headBg:'bg-gradient-to-br from-amber-50 to-yellow-50', headText:'text-amber-800',   badgeBg:'bg-amber-400',   badgeText:'text-white', accentBar:'bg-amber-400'   },
  orange: { cardBorder:'border-orange-300',  headBg:'bg-gradient-to-br from-orange-50 to-amber-50', headText:'text-orange-800',  badgeBg:'bg-orange-500',  badgeText:'text-white', accentBar:'bg-orange-400'  },
  red:    { cardBorder:'border-red-300',     headBg:'bg-gradient-to-br from-red-50 to-rose-50',     headText:'text-red-800',     badgeBg:'bg-red-500',     badgeText:'text-white', accentBar:'bg-red-500'     },
}

// ── 支撐壓力帶 ───────────────────────────────────────────────
function SRBand({ level, dir, techMode }: { level: SRLevel; dir: 'support'|'resistance'; techMode: boolean }) {
  const isSup = dir === 'support'
  const label = techMode
    ? level.label
    : isSup
      ? SR_PLAIN.support.label(level.rank, level.strength === 'strong')
      : SR_PLAIN.resistance.label(level.rank, level.strength === 'strong')

  return (
    <div className={`flex items-stretch gap-3 p-3 rounded-2xl border ${isSup ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
      <div className={`w-1 rounded-full flex-shrink-0 ${isSup ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-extrabold tracking-wide mb-0.5 ${isSup ? 'text-emerald-600' : 'text-red-600'}`}>
          {label}
        </div>
        <div className={`text-lg font-extrabold ${isSup ? 'text-emerald-700' : 'text-red-700'}`}>
          {level.range_low} ～ {level.range_high}
        </div>
        <div className="text-[10px] text-stone-400 mt-0.5">
          {techMode
            ? `強度 ${level.score.toFixed(0)} · ${level.sources.join(', ')}`
            : (isSup ? SR_PLAIN.support.desc : SR_PLAIN.resistance.desc)}
        </div>
      </div>
    </div>
  )
}

// ── 四情境卡片 ───────────────────────────────────────────────
function ScenarioCard({ icon, title, price, action, desc, cls }: {
  icon: string; title: string; price: string; action: string; desc: string; cls: string
}) {
  return (
    <div className={`rounded-2xl border p-3.5 ${cls}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-[11px] font-extrabold tracking-wide">{title}</span>
      </div>
      <div className="text-base font-extrabold mb-0.5">{price}</div>
      <div className="text-xs font-bold mb-1.5">{action}</div>
      <div className="text-[10px] opacity-70 leading-relaxed">{desc}</div>
    </div>
  )
}

// ── 決策卡主體 ───────────────────────────────────────────────
function DecisionCard({ result, techMode, hasHolding }: {
  result: AnalysisResponse; techMode: boolean; hasHolding: boolean
}) {
  const card   = result.decision_card
  const color  = card.signal.color
  const sp     = SIGNAL_PLAIN[color]
  const rp     = RISK_PLAIN[card.risk.level]
  const sty    = SIG[color]

  const nearSup = card.support_levels[0]?.range_high ?? null
  const nearRes = card.resistance_levels[0]?.range_low ?? null
  const ol      = generateOneLiner(color, hasHolding, card.name, card.price, nearSup, nearRes)

  const stopLoss  = card.stop_loss
  const sup1      = card.support_levels[0]
  const res1      = card.resistance_levels[0]
  const res2      = card.resistance_levels[1]

  // 四情境
  const scenarios = [
    {
      icon: '📉', title: techMode ? '跌破第一支撐' : '跌到地板價以下',
      price: sup1 ? `< ${sup1.range_low}` : '—',
      action: techMode ? '觀察是否守住' : '要特別留意',
      desc: techMode ? '支撐若不守，下方風險增加' : '跌到這裡要觀察，可能繼續跌',
      cls: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    },
    {
      icon: '🔝', title: techMode ? '接近第一壓力' : '快到天花板了',
      price: res1 ? `${res1.range_low} 附近` : '—',
      action: techMode ? '考慮減碼' : '可以賣一部分',
      desc: techMode ? '接近壓力，風險報酬比下降' : '漲到這裡可以考慮先賣一部分',
      cls: 'bg-orange-50 border-orange-200 text-orange-800',
    },
    {
      icon: '🚀', title: techMode ? '突破第二壓力' : '漲破第二關',
      price: res2 ? `> ${res2.range_high}` : '—',
      action: techMode ? '大幅減碼或出場' : '考慮大部分出場',
      desc: techMode ? '強壓力突破，評估獲利了結' : '漲到這麼高，建議大部分賣出',
      cls: 'bg-red-50 border-red-200 text-red-800',
    },
    {
      icon: '🛡️', title: techMode ? '跌破停損線' : '跌破最後防線',
      price: `< ${stopLoss}`,
      action: techMode ? '執行停損' : '建議賣出',
      desc: techMode ? '已達停損位，依計畫執行' : '跌到這裡損失可能繼續擴大',
      cls: 'bg-red-100 border-red-300 text-red-900',
    },
  ]

  return (
    <div className={`rounded-3xl border-2 overflow-hidden shadow-md ${sty.cardBorder}`}>
      {/* 標頭 */}
      <div className={`${sty.headBg} px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xl leading-none">{sp.emoji}</span>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${sty.badgeBg} ${sty.badgeText} shadow-sm`}>
                {techMode ? sp.techLabel : sp.badge}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${rp.bg} ${rp.color}`}>
                {techMode ? rp.techLabel : rp.label}
              </span>
            </div>
            <div className={`text-[11px] ${sty.headText} opacity-80 leading-relaxed`}>
              {techMode ? card.signal.desc : sp.headDesc}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-extrabold text-stone-800 leading-none">{card.price}</div>
            <div className="text-[10px] text-stone-400 mt-1">現價</div>
          </div>
        </div>
      </div>

      {/* 主建議 */}
      <div className="bg-white px-5 pt-4 pb-3 border-b border-stone-100">
        <div className="text-[10px] font-bold text-stone-400 tracking-widest mb-2">
          {techMode ? '目前建議' : '📌 現在該怎麼做？'}
        </div>
        <div className="text-[26px] font-extrabold text-stone-900 leading-tight mb-2">
          {techMode ? card.main_action : ol.action}
        </div>
        <p className="text-sm text-stone-500 leading-relaxed">
          {techMode ? card.reason : ol.reason}
        </p>
        {!techMode && (
          <div className="mt-2 inline-block text-[10px] text-stone-400 bg-stone-50 border border-stone-100 px-2.5 py-1 rounded-full">
            {ol.techHint}
          </div>
        )}
      </div>

      {/* 支撐 / 壓力 */}
      <div className="bg-white px-5 pt-3 pb-3 border-b border-stone-100">
        <div className="text-[10px] font-bold text-stone-400 tracking-widest mb-2.5">
          {techMode ? '支撐 / 壓力區間' : '💡 價格參考區間'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {card.support_levels.map(s => (
            <SRBand key={`s${s.rank}`} level={s} dir="support" techMode={techMode} />
          ))}
          {card.resistance_levels.map(r => (
            <SRBand key={`r${r.rank}`} level={r} dir="resistance" techMode={techMode} />
          ))}
        </div>
      </div>

      {/* 停損 */}
      <div className="bg-white px-5 pt-3 pb-3 border-b border-stone-100">
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <div>
            <div className="text-xs font-extrabold text-orange-700">
              {techMode ? '建議停損' : '🚨 超過這個價就建議賣掉'}
            </div>
            {!techMode && <div className="text-[10px] text-orange-500 mt-0.5">跌到這裡損失可能繼續擴大</div>}
          </div>
          <div className="text-2xl font-extrabold text-orange-700">{stopLoss}</div>
        </div>
      </div>

      {/* 四情境 */}
      <div className="bg-white px-5 pt-3 pb-4">
        <div className="text-[10px] font-bold text-stone-400 tracking-widest mb-2.5">
          {techMode ? '四種情境分析' : '📋 遇到這些情況怎麼辦？'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {scenarios.map(s => <ScenarioCard key={s.title} {...s} />)}
        </div>
        <p className="text-center text-[10px] text-stone-300 mt-3 leading-relaxed">
          以上為機率評估，不保證走勢，請自行判斷
        </p>
      </div>
    </div>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
function AnalyzeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { trades }   = useTradeStore()
  const { techMode } = useUIStore()

  const [query, setQuery]         = useState(searchParams.get('q') ?? '')
  const [sugg, setSugg]           = useState<SearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<AnalysisResponse | null>(null)
  const [klines, setKlines]       = useState<KLine[]>([])
  const [tab, setTab]             = useState<Tab>('card')
  const [currentCode, setCode]    = useState('')

  const holdingStats = useMemo(() => {
    if (!currentCode || !result) return null
    const ct = trades.filter(t => t.code === currentCode)
    if (!ct.length) return null
    return calcHoldingStats(currentCode, result.basic.name, ct, result.basic.current_price)
  }, [currentCode, result, trades])

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setSugg([]); return }
    setSugg((await searchStocks(q).catch(() => [])).slice(0, 6))
  }

  const runAnalysis = async (code: string) => {
    setLoading(true); setError(''); setSugg([])
    try {
      const [analysis, history] = await Promise.all([analyzeStock(code), getStockHistory(code)])
      setResult(analysis); setKlines(history.klines)
      setCode(code); setTab('card')
      router.replace(`/analyze?q=${code}`, { scroll: false })
    } catch (e: any) {
      setError(e.message || '分析失敗，請確認代號後重試')
    } finally { setLoading(false) }
  }

  // 有 ?q= 自動觸發
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !result) runAnalysis(q)
  }, [])

  const basic = result?.basic
  const card  = result?.decision_card

  const TABS: { key: Tab; label: string }[] = [
    { key: 'card',   label: techMode ? '決策卡' : '建議' },
    { key: 'chart',  label: 'K 線圖' },
    { key: 'detail', label: techMode ? '支撐壓力' : '高低點' },
    { key: 'ai',     label: techMode ? 'AI 摘要' : 'AI 解說' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* 搜尋列 */}
        <form onSubmit={e => { e.preventDefault(); const c = query.trim().split(/\s+/)[0]; if (c) runAnalysis(c) }}>
          <div className="relative">
            <input value={query} onChange={e => handleSearch(e.target.value)}
              placeholder={techMode ? '輸入代號，如 6770、2330' : '輸入股票代號或名稱，例如 台積電、6770'}
              className="w-full h-12 pl-4 pr-24 bg-white border border-stone-200 rounded-2xl text-sm placeholder-stone-400 shadow-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <button type="submit" disabled={loading}
              className="absolute right-1.5 top-1.5 h-9 px-5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? '…' : '查詢'}
            </button>
          </div>

          {sugg.length > 0 && (
            <div className="mt-1 bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden">
              {sugg.map(s => (
                <button key={s.code} type="button"
                  onClick={() => { setQuery(`${s.code} ${s.name}`); runAnalysis(s.code) }}
                  className="w-full flex justify-between items-center px-4 py-3 text-sm hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0"
                >
                  <span className="font-bold text-stone-700">{s.code}</span>
                  <span className="text-stone-500">{s.name}</span>
                  <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{s.market}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* 錯誤 */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 flex items-center gap-2">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}
        {basic?._mock && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-600 flex items-center gap-2">
            <span>🔧</span> {basic._warning}
          </div>
        )}

        {/* 股票標頭 */}
        {result && basic && card && (
          <>
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xl font-extrabold text-stone-900 leading-tight">{basic.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{basic.code}</span>
                    <span className="text-xs text-stone-400">{basic.market}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-stone-900 leading-none">{basic.current_price}</div>
                  <div className={`text-sm font-bold mt-1 ${basic.change >= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {basic.change >= 0 ? '+' : ''}{basic.change}（{basic.change_pct}%）
                  </div>
                </div>
              </div>
              {/* 燈號行 */}
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{SIGNAL_PLAIN[card.signal.color].emoji}</span>
                <span className="text-sm font-bold text-stone-700">
                  {techMode ? SIGNAL_PLAIN[card.signal.color].techLabel : SIGNAL_PLAIN[card.signal.color].label}
                </span>
                <span className="text-xs text-stone-400">·</span>
                <span className="text-xs text-stone-400">
                  {techMode ? '52週' : '歷史'} {basic.week52_low} ～ {basic.week52_high}
                </span>
              </div>
            </div>

            {/* Tab 列 */}
            <div className="flex bg-white rounded-2xl border border-stone-100 shadow-sm p-1 gap-1">
              {TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    tab === key
                      ? 'bg-amber-400 text-white shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >{label}</button>
              ))}
            </div>

            {/* Tab 內容 */}
            {tab === 'card' && (
              <div className="space-y-3">
                <DecisionCard result={result} techMode={techMode} hasHolding={!!holdingStats?.currentShares} />
                {holdingStats
                  ? <MyHoldingCard stats={holdingStats} currentPrice={basic.current_price} compact />
                  : (
                    <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4 text-center">
                      <div className="text-xs text-stone-400">
                        尚無此股票的交易紀錄 ·
                        <a href="/portfolio" className="text-amber-500 font-medium ml-1">前往新增 →</a>
                      </div>
                    </div>
                  )
                }
              </div>
            )}

            {tab === 'chart' && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <Suspense fallback={<div className="h-72 flex items-center justify-center text-stone-400 text-sm">圖表載入中…</div>}>
                  <StockChart
                    klines={klines}
                    supportLevels={card.support_levels}
                    resistanceLevels={card.resistance_levels}
                    stopLoss={card.stop_loss}
                    height={320}
                  />
                </Suspense>
              </div>
            )}

            {tab === 'detail' && (
              <div className="space-y-2">
                {card.support_levels.map(s => (
                  <SRBand key={`s${s.rank}`} level={s} dir="support" techMode={techMode} />
                ))}
                {card.resistance_levels.map(r => (
                  <SRBand key={`r${r.rank}`} level={r} dir="resistance" techMode={techMode} />
                ))}
                <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
                  <div>
                    <div className="text-xs font-extrabold text-orange-700">
                      {techMode ? SR_PLAIN.stopLoss.techLabel : SR_PLAIN.stopLoss.label}
                    </div>
                    {!techMode && <div className="text-[10px] text-orange-500 mt-0.5">{SR_PLAIN.stopLoss.desc}</div>}
                  </div>
                  <div className="text-2xl font-extrabold text-orange-700">{card.stop_loss}</div>
                </div>
                {/* 買賣區間 */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { label: techMode ? '建議買進區' : '📉 便宜買點', zone: result.buy_zone, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    { label: techMode ? '建議賣出區' : '📈 賣出高點', zone: result.sell_zone, cls: 'bg-red-50 border-red-200 text-red-700' },
                  ].map(({ label, zone, cls }) => (
                    <div key={label} className={`rounded-2xl border p-3.5 ${cls}`}>
                      <div className="text-[10px] font-extrabold mb-1 tracking-wide">{label}</div>
                      <div className="text-base font-extrabold">{zone[0]} ～ {zone[1]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'ai' && (
              <AITranslateCard card={card} holdingStats={holdingStats} />
            )}
          </>
        )}

        {/* 空白狀態 */}
        {!result && !loading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
              📊
            </div>
            <div className="text-base font-bold text-stone-600 mb-1">
              {techMode ? '輸入股票代號開始分析' : '查詢任一支股票'}
            </div>
            <div className="text-xs text-stone-400">支援上市上櫃 1,937 檔</div>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm text-stone-400">分析中，請稍候…</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F5F3] flex items-center justify-center text-stone-400">載入中…</div>}>
      <AnalyzeContent />
    </Suspense>
  )
}
