'use client'

import { useState, useMemo } from 'react'
import { analyzeStock, getStockHistory, searchStocks } from '@/lib/api'
import { useTradeStore, calcHoldingStats } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { SIGNAL_PLAIN, ZONE_PLAIN, SR_PLAIN } from '@/lib/plain-talk'
import type { AnalysisResponse, KLine, SearchResult } from '@/types'
import LazyDecisionCard from '@/components/cards/LazyDecisionCard'
import MyHoldingCard from '@/components/cards/MyHoldingCard'
import AITranslateCard from '@/components/cards/AITranslateCard'
import StockChart from '@/components/charts/StockChart'

type Tab = 'decision' | 'ai' | 'chart' | 'sr'

export default function AnalyzePage() {
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<AnalysisResponse | null>(null)
  const [klines, setKlines]           = useState<KLine[]>([])
  const [tab, setTab]                 = useState<Tab>('decision')
  const [currentCode, setCurrentCode] = useState('')

  const { trades }   = useTradeStore()
  const { techMode } = useUIStore()

  const holdingStats = useMemo(() => {
    if (!currentCode || !result) return null
    const codeT = trades.filter((t) => t.code === currentCode)
    if (codeT.length === 0) return null
    return calcHoldingStats(currentCode, result.basic.name, codeT, result.basic.current_price)
  }, [currentCode, result, trades])

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q) { setSuggestions([]); return }
    try { setSuggestions((await searchStocks(q)).slice(0, 6)) }
    catch { setSuggestions([]) }
  }

  const runAnalysis = async (code: string) => {
    setLoading(true); setError(''); setSuggestions([])
    try {
      const [analysis, history] = await Promise.all([
        analyzeStock(code), getStockHistory(code),
      ])
      setResult(analysis); setKlines(history.klines)
      setCurrentCode(code); setTab('decision')
    } catch (e: any) {
      setError(e.message || '分析失敗，請確認代號後重試')
    } finally { setLoading(false) }
  }

  const basic = result?.basic
  const card  = result?.decision_card
  const sp    = card ? SIGNAL_PLAIN[card.signal.color] : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'decision', label: techMode ? '決策卡' : '建議' },
    { key: 'ai',       label: techMode ? '技術摘要' : 'AI 說明' },
    { key: 'chart',    label: 'K 線圖' },
    { key: 'sr',       label: techMode ? '支撐壓力' : '高低點' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* 搜尋 */}
        <form onSubmit={(e) => {
          e.preventDefault()
          const c = query.trim().split(/\s+/)[0]
          if (c) runAnalysis(c)
        }}>
          <div className="relative mb-3">
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={techMode ? '輸入代號或名稱，如 6770' : '輸入股票代號或名稱，例如：台積電、2330'}
              className="w-full px-4 py-3 pr-24 bg-white border border-stone-200 rounded-2xl text-sm placeholder-stone-400 shadow-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="submit" disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              {loading ? '分析中…' : '查詢'}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="mb-3 bg-white border border-stone-200 rounded-xl shadow overflow-hidden">
              {suggestions.map((s) => (
                <button key={s.code} type="button"
                  onClick={() => { setQuery(`${s.code} ${s.name}`); runAnalysis(s.code) }}
                  className="w-full flex justify-between items-center px-4 py-2.5 text-sm hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-700">{s.code}</span>
                  <span className="text-stone-500">{s.name}</span>
                  <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{s.market}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}
        {basic?._mock && (
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-600">
            🔧 {basic._warning}
          </div>
        )}

        {result && basic && card && sp && (
          <>
            {/* 股票標頭 */}
            <div className="bg-white rounded-2xl border border-stone-200 px-4 py-3 mb-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-stone-800">{basic.name}</div>
                  <div className="text-xs text-stone-400">{basic.code} · {basic.market}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-stone-800">{basic.current_price}</div>
                  <div className={`text-sm font-medium ${basic.change >= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {basic.change >= 0 ? '+' : ''}{basic.change} ({basic.change_pct}%)
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-1.5 text-xs text-stone-400">
                <span>{techMode ? '52週高' : '歷史高'} {basic.week52_high}</span>
                <span>{techMode ? '52週低' : '歷史低'} {basic.week52_low}</span>
                <span>成交 {basic.volume.toLocaleString()} 張</span>
              </div>
              <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${sp.sigCls}`}>
                <span>{sp.emoji}</span>
                <span>{techMode ? sp.techLabel : sp.label}</span>
              </div>
              {!techMode && (
                <div className="mt-1.5 text-xs text-stone-500 leading-relaxed">
                  {SIGNAL_PLAIN[card.signal.color].headDesc}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex bg-stone-100 rounded-xl p-1 mb-3 gap-1">
              {TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    tab === key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
                  }`}
                >{label}</button>
              ))}
            </div>

            {/* Tab 內容 */}
            {tab === 'decision' && (
              <div className="space-y-3">
                <LazyDecisionCard card={card} hasHolding={!!holdingStats?.currentShares} />
                {holdingStats && holdingStats.currentShares > 0 ? (
                  <MyHoldingCard stats={holdingStats} currentPrice={basic.current_price} compact />
                ) : (
                  <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-400 text-center">
                    尚無此股票的交易紀錄 · <a href="/portfolio" className="text-amber-500">前往新增 →</a>
                  </div>
                )}
              </div>
            )}

            {tab === 'ai' && (
              <AITranslateCard card={card} holdingStats={holdingStats} />
            )}

            {tab === 'chart' && (
              <StockChart
                klines={klines}
                supportLevels={card.support_levels}
                resistanceLevels={card.resistance_levels}
                stopLoss={card.stop_loss}
                height={320}
              />
            )}

            {tab === 'sr' && (
              <div className="space-y-2">
                {card.support_levels.map((s) => (
                  <div key={s.rank} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between">
                    <div>
                      <div className="text-xs font-semibold text-emerald-600">
                        {techMode ? s.label : SR_PLAIN.support.label(s.rank, s.strength === 'strong')}
                      </div>
                      <div className="text-sm font-bold text-emerald-700">{s.range_low} ～ {s.range_high}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {techMode ? `強度 ${s.score.toFixed(0)}｜${s.sources.join(', ')}` : SR_PLAIN.support.desc}
                      </div>
                    </div>
                  </div>
                ))}
                {card.resistance_levels.map((r) => (
                  <div key={r.rank} className="p-3 bg-red-50 border border-red-100 rounded-xl flex justify-between">
                    <div>
                      <div className="text-xs font-semibold text-red-600">
                        {techMode ? r.label : SR_PLAIN.resistance.label(r.rank, r.strength === 'strong')}
                      </div>
                      <div className="text-sm font-bold text-red-700">{r.range_low} ～ {r.range_high}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {techMode ? `強度 ${r.score.toFixed(0)}｜${r.sources.join(', ')}` : SR_PLAIN.resistance.desc}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center p-3 bg-orange-50 border border-orange-100 rounded-xl">
                  <div>
                    <div className="text-xs font-semibold text-orange-600">
                      {techMode ? SR_PLAIN.stopLoss.techLabel : SR_PLAIN.stopLoss.label}
                    </div>
                    {!techMode && <div className="text-[10px] text-stone-400">{SR_PLAIN.stopLoss.desc}</div>}
                  </div>
                  <div className="text-lg font-bold text-orange-700">{card.stop_loss}</div>
                </div>
                <div className="p-3 text-xs text-stone-400 text-center">{result.disclaimer}</div>
              </div>
            )}
          </>
        )}

        {!result && !loading && (
          <div className="text-center py-16 text-stone-400">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm">
              {techMode ? '輸入股票代號開始分析' : '輸入股票代號或名稱，馬上知道現在該怎麼做'}
            </div>
            <div className="text-xs mt-1 text-stone-300">支援上市上櫃 1,937 檔</div>
          </div>
        )}
        {loading && (
          <div className="text-center py-16 text-stone-400">
            <div className="text-3xl mb-3 animate-spin">⚙️</div>
            <div className="text-sm">分析中，請稍候…</div>
          </div>
        )}
      </div>
    </div>
  )
}
