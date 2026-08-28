'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { analyzeStock, getStockHistory, searchStocks, getTechIndicators, getInstitutional } from '@/lib/api'
import type { InstitutionalResponse } from '@/lib/api'
import { useTradeStore, calcHoldingStats } from '@/stores'
import { useUIStore } from '@/stores/ui'
import {
  SIGNAL_PLAIN, SR_PLAIN,
  generateOneLiner, generateAISections,
} from '@/lib/plain-talk'
import { safeVal, safePct } from '@/lib/safe-display'
import { calcConfidenceLevel } from '@/lib/ai-note-generator'
import type { AnalysisResponse, KLine, SearchResult, SignalColor, SRLevel, TechIndicators } from '@/types'
import dynamic from 'next/dynamic'
import NbBadge from '@/components/nb/NbBadge'

const StockChart = dynamic(() => import('@/components/charts/StockChart'), { ssr: false })

// ── 燈號 → nb-badge 對照 ─────────────────────────────────────
const SIG_BADGE: Record<SignalColor, 'green' | 'orange' | 'red' | 'yellow'> = {
  green: 'green', yellow: 'yellow', orange: 'orange', red: 'red',
}

// ── 今天的小筆記（分析頁版）──────────────────────────────────
function AnalyzeNoteCard({
  sections, techMode, hasHolding,
  confidenceLevel,
}: {
  sections: ReturnType<typeof generateAISections>
  techMode: boolean
  hasHolding: boolean
  confidenceLevel?: 'high' | 'mid' | 'low'
}) {
  const [openReasons, setOpenReasons] = useState(false)

  const CONF_MAP = {
    high: { label: '🟢 高把握',       cls: 'text-nb-green' },
    mid:  { label: '🟡 普通把握',     cls: 'text-nb-yellow' },
    low:  { label: '🔴 今天變數較大', cls: 'text-nb-red' },
  }
  const conf = CONF_MAP[confidenceLevel ?? 'mid']

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-nb-s2 to-[#EBE0CF] border border-nb-border2 shadow-nb-lg p-5">
      <span className="absolute right-4 top-3 text-5xl opacity-[.07] rotate-[10deg] select-none pointer-events-none">
        📒
      </span>

      {/* 頂部：標題 + 把握程度（標籤，無數字）*/}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-extrabold text-nb-t3 tracking-widest uppercase">
          今天的小筆記
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-extrabold ${conf.cls}`}>
            {conf.label}
          </span>
        </div>
      </div>

      {/* 第一段：今天怎麼看（最大、最重要，直接顯示）*/}
      <div className="mb-4">
        <div className="text-[10px] font-extrabold text-nb-t2 tracking-wider uppercase mb-2">
          {techMode ? '今天怎麼看' : '今天我怎麼看'}
        </div>
        <p className="text-[14px] text-nb-t1 leading-[1.85]">{sections.situation}</p>
        <p className="text-[13px] text-nb-t2 leading-[1.75] mt-2">{sections.riskExplain}</p>
      </div>

      {/* 第二段：如果是我（直接顯示，不放展開區）*/}
      <div className="bg-nb-s0/50 rounded-xl px-4 py-3 mb-3 border-l-[3px] border-nb-orange">
        <div className="text-[10px] font-extrabold text-nb-orange tracking-wide mb-1.5">
          {techMode ? '操作策略建議' : '如果是我，今天會……'}
        </div>
        <p className="text-[13px] text-nb-t0 leading-[1.85] whitespace-pre-line">
          {sections.whatToDo}
        </p>
      </div>

      {/* 第三段：原因分析（可展開）*/}
      <button
        onClick={() => setOpenReasons(v => !v)}
        className="w-full flex items-center justify-between bg-nb-s0/55 rounded-xl px-4 py-3 text-[12px] font-extrabold text-nb-t0 transition-colors hover:bg-nb-s0/70"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]">🔍</span>
          <span>{techMode ? '技術面判斷依據' : '為什麼我這樣判斷？'}</span>
        </div>
        <span className={`text-nb-t3 transition-transform text-xs ${openReasons ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {openReasons && (
        <div className="bg-nb-s0/55 rounded-xl px-4 py-3 mt-2 animate-fade-in">
          <p className="text-[12px] text-nb-t1 leading-[1.8]">{sections.riskExplain}</p>
          {sections.watchOut && (
            <div className="mt-3 pt-3 border-t border-nb-border/40">
              <div className="text-[10px] font-extrabold text-nb-orange tracking-wider mb-1">特別留意</div>
              <p className="text-[12px] text-nb-t1 leading-[1.7]">{sections.watchOut}</p>
            </div>
          )}
        </div>
      )}

      {/* 持股資訊（有持股才顯示）*/}
      {hasHolding && sections.whatToDo && (
        <div className="mt-3 bg-nb-s0/50 rounded-xl px-4 py-3 border-t border-nb-border/30">
          <div className="text-[10px] font-extrabold text-nb-t2 tracking-wider mb-1">我的持股</div>
          <p className="text-[12px] text-nb-t1 leading-[1.75]">{sections.whatToDo}</p>
        </div>
      )}
    </div>
  )
}

// ── 支撐壓力帶（nb 色系版）────────────────────────────────────
function SRBand({ level, dir, techMode }: {
  level: SRLevel; dir: 'support' | 'resistance'; techMode: boolean
}) {
  const isSup = dir === 'support'
  const label = techMode
    ? level.label
    : isSup
      ? SR_PLAIN.support.label(level.rank, level.strength === 'strong')
      : SR_PLAIN.resistance.label(level.rank, level.strength === 'strong')

  return (
    <div className={`flex items-stretch gap-3 p-3.5 rounded-2xl border ${
      isSup
        ? 'bg-nb-green-bg border-nb-green/20'
        : 'bg-nb-orange-bg border-nb-orange/20'
    }`}>
      <div className={`w-1 rounded-full flex-shrink-0 ${isSup ? 'bg-nb-green' : 'bg-nb-orange'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-extrabold tracking-wide mb-0.5 ${isSup ? 'text-nb-green' : 'text-nb-orange'}`}>
          {label}
        </div>
        <div className={`text-lg font-extrabold ${isSup ? 'text-nb-green' : 'text-nb-orange'}`}>
          {level.range_low} ～ {level.range_high}
        </div>
        <div className="text-[10px] text-nb-t3 mt-0.5">
          {techMode
            ? `強度 ${(level.score ?? 0).toFixed(0)} · ${level.sources.join(', ')}`
            : isSup ? SR_PLAIN.support.desc : SR_PLAIN.resistance.desc}
        </div>
      </div>
    </div>
  )
}

// ── 主內容 ───────────────────────────────────────────────────
function AnalyzeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { trades } = useTradeStore()
  const { techMode } = useUIStore()

  const [query, setQuery]   = useState(searchParams.get('q') ?? '')
  const [sugg, setSugg]     = useState<SearchResult[]>([])

  // 細化三個獨立 loading：主分析、技術指標、法人資料各自獨立
  const [loadingMain, setLoadingMain]   = useState(false)
  const [loadingIndic, setLoadingIndic] = useState(false)
  const [loadingInst, setLoadingInst]   = useState(false)

  const [error, setError]   = useState('')
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [klines, setKlines] = useState<KLine[]>([])
  const [indicators, setIndicators] = useState<TechIndicators | null>(null)
  const [institutional, setInstitutional] = useState<InstitutionalResponse | null>(null)
  const [currentCode, setCode] = useState('')

  // 衍生 loading：任一子任務進行中
  const loading = loadingMain || loadingIndic || loadingInst

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

  // 白話錯誤訊息轉換
  const toPlainError = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('404') || msg.toLowerCase().includes('not found'))
      return '找不到這支股票，請確認代號是否正確'
    if (msg.includes('503') || msg.includes('502'))
      return '資料來源暫時無法連線，請稍後再試'
    if (msg.toLowerCase().includes('timeout'))
      return '連線逾時，請稍後再試'
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch'))
      return '網路連線失敗，請確認網路狀態後重試'
    return '分析失敗，請確認代號後重試'
  }

  const runAnalysis = async (code: string) => {
    setError(''); setSugg([])
    setResult(null); setKlines([])
    setIndicators(null); setInstitutional(null)

    // ① 主分析（K 線 + 燈號）：必要，失敗則停止
    setLoadingMain(true)
    let analysis: AnalysisResponse
    let historyKlines: KLine[]
    try {
      const [a, h] = await Promise.all([analyzeStock(code), getStockHistory(code)])
      analysis = a
      historyKlines = h.klines
      setResult(analysis); setKlines(historyKlines)
      setCode(code)
      router.replace(`/analyze?q=${code}`, { scroll: false })
    } catch (e) {
      setError(toPlainError(e))
      setLoadingMain(false)
      return
    }
    setLoadingMain(false)

    // ② 技術指標與法人：次要，失敗不阻斷頁面，各自獨立
    setLoadingIndic(true)
    getTechIndicators(code)
      .then(indic => setIndicators(indic))
      .catch(() => setIndicators(null))  // 失敗：指標區顯示「—」
      .finally(() => setLoadingIndic(false))

    setLoadingInst(true)
    getInstitutional(code)
      .then(inst => setInstitutional(inst))
      .catch(() => setInstitutional(null))  // 失敗：法人區顯示降級訊息
      .finally(() => setLoadingInst(false))
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !result) runAnalysis(q)
  }, []) // eslint-disable-line

  const basic = result?.basic
  const card  = result?.decision_card

  // 產生 AI 分析段落
  const aiSections = useMemo(() => {
    if (!basic || !card) return null
    return generateAISections(
      card.signal.color,
      card.risk.level,
      basic.name,
      basic.current_price,
      card.support_levels[0]?.range_high ?? null,
      card.resistance_levels[0]?.range_low ?? null,
      card.stop_loss,
      !!holdingStats?.currentShares,
      holdingStats?.avgCost ?? null,
    )
  }, [basic, card, holdingStats])

  // 動態信心程度：依燈號顏色與風險等級計算
  const confidenceLevel = useMemo(() => {
    if (!card) return 'mid' as const
    // 後端 risk.level 用 'medium'，前端統一用 'mid'
    const riskLevel = card.risk.level === 'medium' ? 'mid' : card.risk.level as 'low' | 'mid' | 'high'
    return calcConfidenceLevel(card.signal.color, riskLevel)
  }, [card])

  return (
    <div className="min-h-screen bg-nb-bg">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* 搜尋 */}
        <form onSubmit={e => {
          e.preventDefault()
          const q = query.trim()
          if (!q) return
          if (sugg.length > 0) {
            setQuery(`${sugg[0].code} ${sugg[0].name}`)
            runAnalysis(sugg[0].code)
            return
          }
          const m = q.match(/^([0-9]{2,6}[A-Za-z]?)/)
          if (m) { runAnalysis(m[1].toUpperCase()); return }
          handleSearch(q)
        }}>
          <div className="relative">
            <input
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder={techMode ? '輸入代號，如 6770、2330、00878' : '輸入股票代號或名稱'}
              className="w-full h-12 pl-4 pr-20 bg-nb-s0 border border-nb-border2 rounded-2xl text-[14px] text-nb-t0 placeholder-nb-t3 shadow-nb focus:outline-none focus:border-nb-orange/50 focus:ring-2 focus:ring-nb-orange/10"
            />
            <button
              type="submit" disabled={loading}
              className="absolute right-1.5 top-1.5 h-9 px-5 bg-nb-t0 hover:bg-nb-t1 text-nb-s0 text-[13px] font-extrabold rounded-xl disabled:opacity-40 transition-colors"
            >
              {loading ? '…' : '查詢'}
            </button>
          </div>

          {sugg.length > 0 && (
            <div className="mt-1 bg-nb-s0 border border-nb-border rounded-2xl shadow-nb-md overflow-hidden">
              {sugg.map(s => (
                <button
                  key={s.code} type="button"
                  onClick={() => { setQuery(`${s.code} ${s.name}`); runAnalysis(s.code) }}
                  className="w-full flex justify-between items-center px-4 py-3 text-[13px] hover:bg-nb-bg transition-colors border-b border-nb-border last:border-0"
                >
                  <span className="font-extrabold text-nb-t0">{s.code}</span>
                  <span className="text-nb-t2">{s.name}</span>
                  <span className="text-[10px] text-nb-t3 bg-nb-bg px-2 py-0.5 rounded-full">{s.market}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* 錯誤 */}
        {error && (
          <div className="p-3.5 bg-nb-red-bg border border-nb-red/20 rounded-2xl text-[13px] text-nb-red flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}
        {basic?._mock && (
          <div className="p-3 bg-nb-s3 border border-nb-border2 rounded-2xl text-[11px] text-nb-t2 flex items-center gap-2">
            <span>🔧</span> {basic._warning}
          </div>
        )}

        {/* ─── 分析結果 ─── */}
        {result && basic && card && aiSections && (
          <div className="space-y-4">

            {/* 股票標頭（簡潔）*/}
            <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb px-4 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[22px] font-black text-nb-t0 tracking-tight leading-none">{basic.name}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-nb-t3 bg-nb-bg px-2 py-0.5 rounded-full font-bold">{basic.code}</span>
                    <NbBadge variant={SIG_BADGE[card.signal.color]} dot>
                      {techMode ? SIGNAL_PLAIN[card.signal.color].techLabel : SIGNAL_PLAIN[card.signal.color].label}
                    </NbBadge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[30px] font-black text-nb-t0 leading-none tracking-tight">
                    {basic.current_price}
                  </div>
                  <div className={`text-[13px] font-extrabold mt-1 ${
                    (basic.change ?? 0) >= 0 ? 'text-nb-up' : 'text-nb-down'
                  }`}>
                    {(basic.change ?? 0) >= 0 ? '+' : ''}{safeVal(basic.change)}（{safePct(basic.change_pct)}）
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-nb-border">
                <p className="text-[13px] text-nb-t1 leading-snug font-semibold">
                  {generateOneLiner(
                    card.signal.color,
                    !!holdingStats?.currentShares,
                    basic.name,
                    basic.current_price,
                    card.support_levels[0]?.range_high ?? null,
                    card.resistance_levels[0]?.range_low ?? null,
                  ).action}
                </p>
              </div>
            </div>

            {/* ① 今天的小筆記（最重要，第一眼就看到）*/}
            <AnalyzeNoteCard
              sections={aiSections}
              techMode={techMode}
              hasHolding={!!holdingStats?.currentShares}
              confidenceLevel={confidenceLevel}
            />

            {/* ② 我的持股（有持股才顯示）*/}
            {holdingStats && holdingStats.currentShares > 0 && (
              <div className="bg-nb-s0 border border-nb-border rounded-2xl shadow-nb overflow-hidden">
                <div className="px-4 py-3 border-b border-nb-border bg-nb-s1">
                  <div className="text-[10px] font-extrabold text-nb-t2 tracking-widest uppercase">
                    {techMode ? '我的持倉' : '我的持股'}
                  </div>
                </div>
                <div className="px-4 py-4">
                  <div className="grid grid-cols-3 gap-0 mb-4">
                    {[
                      { l: techMode ? '加權平均成本' : '買進成本', v: holdingStats.avgCost + ' 元' },
                      { l: '現在股價', v: basic.current_price + ' 元' },
                      { l: techMode ? '未實現損益' : '目前損益',
                        v: holdingStats.unrealizedPnL !== null
                          ? `${holdingStats.unrealizedPnL >= 0 ? '+' : ''}${Math.round(holdingStats.unrealizedPnL).toLocaleString('zh-TW')}`
                          : '—',
                        up: holdingStats.unrealizedPnL !== null ? holdingStats.unrealizedPnL >= 0 : null
                      },
                    ].map(({ l, v, up }, i) => (
                      <div key={i} className={`text-center ${i > 0 ? 'border-l border-nb-border' : ''}`}>
                        <div className="text-[10px] font-extrabold text-nb-t2 mb-1">{l}</div>
                        <div className={`text-[15px] font-black ${
                          up === null ? 'text-nb-t0' : up ? 'text-nb-up' : 'text-nb-down'
                        }`}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-nb-s2 border border-nb-border2 rounded-xl px-3.5 py-2.5 border-l-4 border-l-nb-orange">
                    <div className="text-[10px] font-extrabold text-nb-orange tracking-wider mb-1.5">針對你的持股</div>
                    <p className="text-[12px] text-nb-t1 leading-[1.8]">{aiSections.whatToDo}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ③ K 線（支撐資訊，往下看）*/}
            <div>
              <div className="text-[10px] font-extrabold text-nb-t2 tracking-widest uppercase mb-2 px-0.5">
                {techMode ? 'K 線走勢' : '最近的股價走勢'}
              </div>
              <div className="bg-nb-s4 border border-nb-border rounded-2xl overflow-hidden shadow-nb">
                <Suspense fallback={
                  <div className="h-64 flex items-center justify-center text-nb-t3 text-sm">圖表載入中…</div>
                }>
                  <StockChart
                    klines={klines}
                    supportLevels={card.support_levels}
                    resistanceLevels={card.resistance_levels}
                    stopLoss={card.stop_loss}
                    height={280}
                  />
                </Suspense>
              </div>
            </div>

            {/* ④ 重要價位（支撐資訊）*/}
            {(card.support_levels.length > 0 || card.resistance_levels.length > 0) && (
              <div>
                <div className="text-[10px] font-extrabold text-nb-t2 tracking-widest uppercase mb-2 px-0.5">
                  {techMode ? '支撐壓力區間' : '重要的高低點位置'}
                </div>
                <div className="space-y-2">
                  {card.resistance_levels.map(r => (
                    <SRBand key={`r${r.rank}`} level={r} dir="resistance" techMode={techMode} />
                  ))}
                  {card.support_levels.map(s => (
                    <SRBand key={`s${s.rank}`} level={s} dir="support" techMode={techMode} />
                  ))}
                  <div className="flex items-center justify-between bg-nb-red-bg border border-nb-red/20 rounded-2xl px-4 py-3.5">
                    <div>
                      <div className="text-[10px] font-extrabold text-nb-red tracking-wider">
                        {techMode ? SR_PLAIN.stopLoss.techLabel : SR_PLAIN.stopLoss.label}
                      </div>
                      {!techMode && <div className="text-[11px] text-nb-red/70 mt-0.5">{SR_PLAIN.stopLoss.desc}</div>}
                    </div>
                    <div className="text-[22px] font-black text-nb-red">{card.stop_loss}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ⑤ 買賣區間 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-nb-green-bg border border-nb-green/20 rounded-2xl p-3.5">
                <div className="text-[10px] font-extrabold text-nb-green tracking-wider mb-1">
                  {techMode ? '建議買進區' : '📉 相對便宜的區間'}
                </div>
                <div className="text-[15px] font-black text-nb-green">
                  {result.buy_zone[0]} ～ {result.buy_zone[1]}
                </div>
              </div>
              <div className="bg-nb-orange-bg border border-nb-orange/20 rounded-2xl p-3.5">
                <div className="text-[10px] font-extrabold text-nb-orange tracking-wider mb-1">
                  {techMode ? '建議賣出區' : '📈 相對昂貴的區間'}
                </div>
                <div className="text-[15px] font-black text-nb-orange">
                  {result.sell_zone[0]} ～ {result.sell_zone[1]}
                </div>
              </div>
            </div>

            {/* ⑥ 技術指標（由 /api/analysis/{code}/indicators 提供）*/}
            {loadingIndic ? (
              <div className="bg-nb-s4 border border-nb-border rounded-2xl p-4 text-center">
                <p className="text-[12px] text-nb-t2 animate-pulse">
                  {techMode ? '載入技術指標中…' : '計算各項指標中，請稍候…'}
                </p>
              </div>
            ) : indicators && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-nb-border" />
                  <span className="text-[10px] font-extrabold text-nb-t3 tracking-widest">
                    {techMode ? '技術指標' : '輔助參考指標'}
                  </span>
                  <div className="h-px flex-1 bg-nb-border" />
                </div>

                {/* 均線 */}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'ma5',  label: techMode ? 'MA5'  : '5日均價',  val: indicators.ma5  },
                    { key: 'ma10', label: techMode ? 'MA10' : '10日均價', val: indicators.ma10 },
                    { key: 'ma20', label: techMode ? 'MA20' : '20日均價', val: indicators.ma20 },
                    { key: 'ma60', label: techMode ? 'MA60' : '60日均價', val: indicators.ma60 },
                  ] as const).map(({ key, label, val }) => {
                    const price = result.basic.current_price
                    const isAbove = val !== null && price > val
                    return (
                      <div key={key} className="bg-nb-s4 border border-nb-border rounded-2xl p-3">
                        <div className="text-[10px] font-extrabold text-nb-t2 mb-1">{label}</div>
                        <div className={`text-[15px] font-black ${isAbove ? 'text-nb-red' : 'text-nb-green'}`}>
                          {val !== null ? val.toFixed(2) : '—'}
                        </div>
                        <div className={`text-[10px] font-bold mt-1 ${isAbove ? 'text-nb-red' : 'text-nb-green'}`}>
                          {val !== null
                            ? (isAbove
                              ? (techMode ? '股價站上' : '目前偏強')
                              : (techMode ? '股價跌破' : '目前偏弱'))
                            : '資料不足'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* RSI / 趨勢 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-nb-s4 border border-nb-border rounded-2xl p-3">
                    <div className="text-[10px] font-extrabold text-nb-t2 mb-1">
                      {techMode ? 'RSI(14)' : '市場熱度'}
                    </div>
                    <div className={`text-[15px] font-black ${
                      indicators.rsi !== null && indicators.rsi > 70 ? 'text-nb-red'
                      : indicators.rsi !== null && indicators.rsi < 30 ? 'text-nb-green'
                      : 'text-nb-t0'
                    }`}>
                      {indicators.rsi !== null ? indicators.rsi.toFixed(1) : '—'}
                    </div>
                    <div className="text-[10px] font-bold mt-1 text-nb-t2">
                      {indicators.rsi === null ? '資料不足'
                        : indicators.rsi > 70 ? (techMode ? '超買區' : '目前偏熱，留意風險')
                        : indicators.rsi < 30 ? (techMode ? '超賣區' : '目前偏冷，留意反彈')
                        : (techMode ? '中性區' : '目前沒有過熱')}
                    </div>
                  </div>
                  <div className="bg-nb-s4 border border-nb-border rounded-2xl p-3">
                    <div className="text-[10px] font-extrabold text-nb-t2 mb-1">
                      {techMode ? '趨勢' : '整體走向'}
                    </div>
                    <div className={`text-[15px] font-black ${
                      indicators.trend === 'bull' ? 'text-nb-red'
                      : indicators.trend === 'bear' ? 'text-nb-green'
                      : 'text-nb-t2'
                    }`}>
                      {indicators.trend_label ?? '—'}
                    </div>
                    <div className="text-[10px] font-bold mt-1 text-nb-t2">
                      {!techMode && (
                        indicators.trend === 'bull' ? '最近買的人比賣的多'
                        : indicators.trend === 'bear' ? '最近賣的人比買的多'
                        : '多空力道相當'
                      )}
                    </div>
                  </div>
                </div>

                {/* MACD */}
                {indicators.macd && (
                  <div className="bg-nb-s4 border border-nb-border rounded-2xl p-3">
                    <div className="text-[10px] font-extrabold text-nb-t2 mb-2">
                      {techMode ? 'MACD (12,26,9)' : '買賣動能'}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: techMode ? 'DIF' : '快線', val: indicators.macd.dif },
                        { label: techMode ? 'DEA' : '慢線', val: indicators.macd.dea },
                        { label: techMode ? 'Hist' : '動能柱',
                          val: indicators.macd.hist,
                          color: indicators.macd.hist !== null && indicators.macd.hist > 0 ? 'text-nb-red' : 'text-nb-green' },
                      ].map(({ label, val, color }) => (
                        <div key={label}>
                          <div className="text-[10px] text-nb-t3 mb-1">{label}</div>
                          <div className={`text-[13px] font-black ${color ?? 'text-nb-t0'}`}>
                            {val !== null ? val.toFixed(3) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* KD */}
                {indicators.kd && (
                  <div className="bg-nb-s4 border border-nb-border rounded-2xl p-3">
                    <div className="text-[10px] font-extrabold text-nb-t2 mb-2">
                      {techMode ? 'KD 隨機指標' : 'KD 指標'}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'K', val: indicators.kd.k },
                        { label: 'D', val: indicators.kd.d },
                        { label: 'J', val: indicators.kd.j },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <div className="text-[10px] text-nb-t3 mb-1">{label}</div>
                          <div className={`text-[13px] font-black ${
                            val !== null && val > 80 ? 'text-nb-red'
                            : val !== null && val < 20 ? 'text-nb-green'
                            : 'text-nb-t0'
                          }`}>
                            {val !== null ? val.toFixed(1) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 布林通道 */}
                {indicators.bollinger && (
                  <div className="bg-nb-s4 border border-nb-border rounded-2xl p-3">
                    <div className="text-[10px] font-extrabold text-nb-t2 mb-2">
                      {techMode ? 'Bollinger Bands (20, ±2σ)' : '價格波動區間'}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: techMode ? '上軌' : '高點', val: indicators.bollinger.upper,  cls: 'text-nb-red' },
                        { label: techMode ? '中軌' : '中線', val: indicators.bollinger.middle, cls: 'text-nb-t0' },
                        { label: techMode ? '下軌' : '低點', val: indicators.bollinger.lower,  cls: 'text-nb-green' },
                      ].map(({ label, val, cls }) => (
                        <div key={label}>
                          <div className="text-[10px] text-nb-t3 mb-1">{label}</div>
                          <div className={`text-[13px] font-black ${cls}`}>
                            {val !== null ? val.toFixed(2) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {result.basic.current_price && indicators.bollinger.upper && indicators.bollinger.lower && (
                      <div className="mt-2 text-[10px] text-nb-t2 text-center">
                        {result.basic.current_price > indicators.bollinger.upper
                          ? (techMode ? '股價突破上軌，注意超買' : '目前偏高，留意壓力')
                          : result.basic.current_price < indicators.bollinger.lower
                          ? (techMode ? '股價跌破下軌，注意超賣' : '目前偏低，留意支撐')
                          : (techMode ? '股價在通道內' : '目前在正常波動範圍')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ⑦ 法人動向（由 /api/analysis/{code}/institutional 提供）*/}
            {loadingInst ? (
              <div className="bg-nb-s5 border border-nb-border rounded-2xl p-4 text-center">
                <p className="text-[12px] text-nb-t2 animate-pulse">
                  {techMode ? '載入法人買賣超資料中…' : '查詢三大法人動向中，請稍候…'}
                </p>
              </div>
            ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-nb-border" />
                <span className="text-[10px] font-extrabold text-nb-t3 tracking-widest">
                  {techMode ? '法人動向' : '最近有哪些人在買？'}
                </span>
                <div className="h-px flex-1 bg-nb-border" />
              </div>

              {institutional === null ? (
                /* API 請求失敗（網路錯誤等）*/
                <div className="bg-nb-s4 border border-nb-border rounded-2xl p-4 text-center">
                  <p className="text-[12px] text-nb-t2">目前無法取得法人資料</p>
                </div>
              ) : institutional.dataSource === 'unavailable' ? (
                /* 後端回應正常，但資料來源尚未開放 */
                <div className="bg-nb-s4 border border-nb-border rounded-2xl p-4 text-center space-y-1.5">
                  <p className="text-[12px] font-extrabold text-nb-t2">目前無法取得三大法人資料</p>
                  <p className="text-[11px] text-nb-t3 leading-relaxed">
                    {techMode
                      ? '待後端開放 TWSE/TPEX 連線後將自動更新，不使用估算資料'
                      : '法人買賣超資料需要連線台灣證交所，目前暫時無法取得'}
                  </p>
                </div>
              ) : (
                <>
                  {/* 三大法人累積買賣超 */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      {
                        label: '外資',
                        cum:   institutional.summary.foreignCumulative,
                        trend: institutional.summary.foreignTrend,
                      },
                      {
                        label: techMode ? '投信' : '本土法人',
                        cum:   institutional.summary.investmentCumulative,
                        trend: institutional.summary.investmentTrend,
                      },
                      {
                        label: '自營商',
                        cum:   institutional.summary.dealerCumulative,
                        trend: institutional.summary.dealerTrend,
                      },
                    ]).map(({ label, cum, trend }) => {
                      const isBuy  = trend === 'buy'
                      const isSell = trend === 'sell'
                      return (
                        <div
                          key={label}
                          className={`rounded-2xl p-3 text-center border ${
                            isBuy  ? 'bg-nb-red-bg   border-nb-red/20'
                            : isSell ? 'bg-nb-green-bg border-nb-green/20'
                            : 'bg-nb-s4 border-nb-border'
                          }`}
                        >
                          <div className="text-[10px] font-extrabold text-nb-t2 mb-1.5">{label}</div>
                          <div className={`text-[15px] font-black ${
                            isBuy ? 'text-nb-red' : isSell ? 'text-nb-green' : 'text-nb-t2'
                          }`}>
                            {cum !== null
                              ? `${cum > 0 ? '+' : ''}${Math.round(cum).toLocaleString('zh-TW')}`
                              : '—'}
                          </div>
                          <div className={`text-[10px] font-bold mt-1 ${
                            isBuy ? 'text-nb-red' : isSell ? 'text-nb-green' : 'text-nb-t3'
                          }`}>
                            {isBuy  ? (techMode ? '買超' : '持續買進')
                             : isSell ? (techMode ? '賣超' : '開始調節')
                             : '觀望'}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* AI 白話解讀 */}
                  {institutional.plainTalk && (
                    <div className="bg-nb-s2 border border-nb-orange/20 rounded-2xl p-3.5">
                      <div className="text-[10px] font-extrabold text-nb-orange tracking-wider mb-1.5">
                        {techMode ? 'AI 籌碼解讀' : 'AI 幫你解讀'}
                      </div>
                      <p className="text-[12px] text-nb-t1 leading-relaxed">
                        {institutional.plainTalk}
                      </p>
                      {institutional.note && techMode && (
                        <p className="text-[10px] text-nb-t3 mt-1.5">{institutional.note}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            )} {/* end loadingInst */}

            {/* 無持股引導 */}
            {!holdingStats?.currentShares && (
              <div className="bg-nb-s0 border border-nb-border rounded-2xl p-4 text-center">
                <div className="text-[12px] text-nb-t2">
                  有持有這支股票嗎？
                  <a href="/portfolio" className="text-nb-blue font-extrabold ml-1">前往新增持股 →</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 空狀態 */}
        {!result && !loading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-nb-s2 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
              📒
            </div>
            <div className="text-[16px] font-extrabold text-nb-t0 mb-1.5">
              {techMode ? '輸入代號開始分析' : '查詢任一支股票'}
            </div>
            <div className="text-[12px] text-nb-t3">支援上市上櫃 ETF 共 2,355 檔</div>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="w-14 h-14 border-4 border-nb-border2 border-t-nb-orange rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[13px] text-nb-t2">分析中，請稍候…</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nb-bg flex items-center justify-center text-nb-t2">載入中…</div>
    }>
      <AnalyzeContent />
    </Suspense>
  )
}
