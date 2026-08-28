'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTradeStore, useDividendStore, calcHoldingStats, suggestTradeType } from '@/stores'
import { usePortfolioSignalStore } from '@/stores/portfolio-signal'
import { useUIStore } from '@/stores/ui'
import { getStockBasic, analyzeStock, searchStocks } from '@/lib/api'
import { generateUnstuckText, SIGNAL_PLAIN, generateOneLiner } from '@/lib/plain-talk'
import { calcRealProfit, calcTotalReturn } from '@/lib/fee-calculator'
import { calcStockDividendTotal } from '@/lib/dividend-stats'
import type { SearchResult, HoldingStats, TradeType, SignalColor, InstrumentType } from '@/types'
import NbBadge from '@/components/nb/NbBadge'
import TradeForm from '@/components/cards/TradeForm'
import TradeTimeline from '@/components/cards/TradeTimeline'
import UnstuckProgress from '@/components/ui/UnstuckProgress'
import TrimCalculator from '@/components/ui/TrimCalculator'

// ── 燈號 → NbBadge variant ────────────────────────────────────
const SIG_VARIANT: Record<SignalColor, 'green' | 'orange' | 'red' | 'yellow'> = {
  green: 'green', yellow: 'yellow', orange: 'orange', red: 'red',
}

// ── 工具 ──────────────────────────────────────────────────────
const fmt    = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

const pnlCls = (n: number | null) =>
  n === null ? 'text-nb-t3' : n > 0 ? 'text-nb-up' : n < 0 ? 'text-nb-down' : 'text-nb-t3'

// ── 今日 AI 提醒（最上方，主角）────────────────────────────────
function TodayAlertBanner({
  signals, techMode,
}: {
  signals: { code: string; name: string; color: SignalColor; action: string; desc?: string; unrealizedPct?: number }[]
  techMode: boolean
}) {
  if (signals.length === 0) return null

  const urgent  = signals.filter(s => s.color === 'red' || s.color === 'orange')
  const normal  = signals.filter(s => s.color === 'green' || s.color === 'yellow')
  const display = urgent.length > 0 ? urgent.slice(0, 3) : normal.slice(0, 3)

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-nb-s3 to-[#E5D5C2] border border-nb-border2 shadow-nb-lg p-5">
      <span className="absolute right-4 top-3 text-4xl opacity-[.07] rotate-[10deg] select-none pointer-events-none">
        📒
      </span>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-extrabold text-nb-t3 tracking-widest uppercase">
          {techMode ? '今日持股提醒' : '今天先看這幾檔'}
        </span>
        <div className="flex-1 h-px bg-nb-border2" />
      </div>
      <div className="space-y-2.5">
        {display.map(s => {
          const sp = SIGNAL_PLAIN[s.color]
          const isUrgent = s.color === 'red' || s.color === 'orange'
          return (
            <div key={s.code} className="flex items-start gap-3">
              <span className={`flex-shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                s.color === 'red'    ? 'bg-nb-red' :
                s.color === 'orange' ? 'bg-nb-orange' :
                s.color === 'yellow' ? 'bg-nb-yellow' : 'bg-nb-green'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-extrabold text-nb-t0">{s.name}</span>
                  <NbBadge variant={SIG_VARIANT[s.color]} dot={false}>
                    {techMode ? sp.techLabel : sp.label}
                  </NbBadge>
                </div>
                <p className="text-[12px] text-nb-t1 leading-snug">
                  {s.desc ?? (techMode ? sp.techLabel : sp.headDesc)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      {urgent.length === 0 && (
        <div className="mt-3 pt-3 border-t border-nb-border2/50 text-[11px] text-nb-t3 text-center">
          {techMode ? '今日持股無異常訊號' : '今天持股都還好，可以放心觀察'}
        </div>
      )}
    </div>
  )
}

// ── HoldingInfoTab（內容不變，只套色）─────────────────────────
type ProfitMode = 'book' | 'real'

function HoldingInfoTab({ stats, techMode }: { stats: HoldingStats; techMode: boolean }) {
  const { dividends } = useDividendStore()
  const [mode, setMode] = useState<ProfitMode>('real')

  const price = stats.currentPrice
  const hasPrice = price !== null && price > 0
  const investedCost = Math.round(stats.avgCost * stats.currentShares)
  const dividendIncome = calcStockDividendTotal(dividends, stats.code)

  const realProfit = hasPrice && stats.currentShares > 0
    ? calcRealProfit(stats.avgCost, stats.currentShares, price!, stats.instrumentType)
    : null

  const displayUnrealizedPnL = mode === 'book' ? stats.unrealizedPnL : (realProfit?.realPnL ?? null)
  const displayUnrealizedPct = mode === 'book' ? stats.unrealizedPnLPct : (realProfit?.realPnLPct ?? null)

  const totalReturn = calcTotalReturn(
    stats.realizedPnL,
    displayUnrealizedPnL ?? 0,
    dividendIncome
  )

  return (
    <div className="space-y-3">
      {/* 帳面 / 實際切換 */}
      {hasPrice && stats.currentShares > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-nb-t2 font-bold">
            {techMode ? '損益計算方式' : '要看哪種算法？'}
          </span>
          <div className="flex bg-nb-bg rounded-lg p-0.5 gap-0.5 border border-nb-border">
            {(['book', 'real'] as ProfitMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                  mode === m ? 'bg-nb-s0 text-nb-t0 shadow-sm' : 'text-nb-t3'
                }`}
              >
                {m === 'book' ? (techMode ? '帳面' : '帳面金額') : (techMode ? '實際' : '真正到手')}
              </button>
            ))}
          </div>
        </div>
      )}
      {!techMode && (
        <p className="text-[10px] text-nb-t3 leading-relaxed -mt-1">
          {mode === 'book' ? '帳面金額：還沒扣手續費和證交稅' : '真正到手：扣掉手續費、證交稅後真正會落袋的錢'}
        </p>
      )}

      {/* 基本資訊 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {[
          { l: techMode ? '加權平均成本' : '我的買進成本', v: `${stats.avgCost} 元` },
          { l: techMode ? '最近買進價'   : '最近一次買進', v: stats.latestBuyPrice != null ? `${stats.latestBuyPrice} 元` : '—' },
          { l: techMode ? '持股股數' : '我持有多少股', v: `${fmt(stats.currentShares)} 股（${Math.floor(stats.currentShares / 1000)} 張）` },
          { l: techMode ? '最近賣出價' : '最近一次賣出', v: stats.latestSellPrice != null ? `${stats.latestSellPrice} 元` : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div className="text-[10px] text-nb-t2 mb-0.5 font-bold">{l}</div>
            <div className="text-[13px] font-extrabold text-nb-t0">{v}</div>
          </div>
        ))}
      </div>

      {/* 投入成本 + 市值 */}
      <div className="grid grid-cols-2 gap-x-6 pt-2 border-t border-nb-border">
        <div>
          <div className="text-[10px] text-nb-t2 mb-0.5 font-bold">{techMode ? '投入成本' : '我投入了多少'}</div>
          <div className="text-[13px] font-extrabold text-nb-t0">${fmt(investedCost)}</div>
        </div>
        <div>
          <div className="text-[10px] text-nb-t2 mb-0.5 font-bold">{techMode ? '現在市值' : '現在值多少'}</div>
          <div className="text-[13px] font-extrabold text-nb-t0">
            {stats.currentValue !== null ? `$${fmt(stats.currentValue)}` : '—'}
          </div>
        </div>
      </div>

      {/* 損益三格 */}
      <div className="pt-2 border-t border-nb-border grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-nb-t2 mb-1 font-bold">{techMode ? '未實現損益' : '目前損益'}</div>
          <div className={`text-[13px] font-extrabold ${pnlCls(displayUnrealizedPnL)}`}>
            {displayUnrealizedPnL !== null ? `${displayUnrealizedPnL >= 0 ? '+' : ''}${fmt(displayUnrealizedPnL)}` : '—'}
          </div>
          {displayUnrealizedPct !== null && (
            <div className={`text-[10px] mt-0.5 ${pnlCls(displayUnrealizedPct)}`}>{fmtPct(displayUnrealizedPct)}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] text-nb-t2 mb-1 font-bold">{techMode ? '已實現損益' : '賣出有賺'}</div>
          <div className={`text-[13px] font-extrabold ${pnlCls(stats.realizedPnL)}`}>
            {stats.realizedPnL !== 0 ? `${stats.realizedPnL >= 0 ? '+' : ''}${fmt(stats.realizedPnL)}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-nb-t2 mb-1 font-bold">{techMode ? '股息收入' : '領到的股息'}</div>
          <div className="text-[13px] font-extrabold text-nb-down">
            {dividendIncome > 0 ? `+${fmt(dividendIncome)}` : '—'}
          </div>
        </div>
      </div>

      {/* 真正總報酬 */}
      {hasPrice && stats.currentShares > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-nb-t0 to-[#1A1510] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[9px] text-nb-t3 font-extrabold tracking-widest">
              {techMode ? '真正總報酬' : '我真正賺了多少'}
            </div>
            <div className="text-[9px] text-nb-t2 mt-0.5">{mode === 'book' ? '帳面' : '實際'} +股息+已實現</div>
          </div>
          <div className={`text-[17px] font-black ${totalReturn.totalReturn >= 0 ? 'text-nb-up' : 'text-nb-down'}`}>
            {totalReturn.totalReturn >= 0 ? '+' : ''}{fmt(totalReturn.totalReturn)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Accordion 持股卡 ──────────────────────────────────────────
type CardTab = 'info' | 'unstuck' | 'trim' | 'timeline'

function HoldingCard({ stats, loading, error, signal, sr, srAttempted, onRetryAnalysis, onAddTrade }: {
  stats: HoldingStats
  loading: boolean
  error: string | null
  signal?: { color: SignalColor; label: string; action: string }
  sr?: { resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number }
  srAttempted?: boolean
  onRetryAnalysis: () => void
  onAddTrade: () => void
}) {
  const [open, setOpen]   = useState(false)
  const [tab,  setTab]    = useState<CardTab>('info')
  const { trades, deleteTrade } = useTradeStore()
  const { techMode } = useUIStore()

  const codeTrades = trades.filter(t => t.code === stats.code)
  const price     = stats.currentPrice
  const hasPrice  = price !== null && price > 0

  // 解套文字
  const unstuck = hasPrice && stats.currentShares > 0 && stats.distanceToBreakeven !== null
    ? generateUnstuckText(stats.avgCost, price!, stats.currentShares, stats.distanceToBreakeven!)
    : null

  const TABS: { key: CardTab; label: string; hide?: boolean }[] = [
    { key: 'info',     label: techMode ? '持股資訊' : '資訊' },
    { key: 'unstuck',  label: techMode ? '解套進度' : '回本進度', hide: !hasPrice || stats.isProfit === true },
    { key: 'trim',     label: techMode ? '減碼試算' : '賣多少',   hide: !hasPrice || stats.currentShares === 0 },
    { key: 'timeline', label: `紀錄（${codeTrades.length}）` },
  ]

  return (
    <div className={`bg-nb-s0 rounded-2xl border shadow-nb overflow-hidden transition-all ${
      open ? 'border-nb-border2' : 'border-nb-border'
    }`}>
      {/* ── Accordion Header（收合狀態下的一行摘要）── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* 燈號色點 */}
          <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${
            loading ? 'bg-nb-border2 animate-pulse' :
            signal?.color === 'red'    ? 'bg-nb-red' :
            signal?.color === 'orange' ? 'bg-nb-orange' :
            signal?.color === 'yellow' ? 'bg-nb-yellow' :
            signal?.color === 'green'  ? 'bg-nb-green' : 'bg-nb-border2'
          }`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-extrabold text-nb-t0 leading-tight">{stats.name}</span>
              <span className="text-[10px] text-nb-t3 bg-nb-bg px-2 py-0.5 rounded-full font-bold">{stats.code}</span>
            </div>
            {stats.currentShares > 0 && (
              <div className="text-[11px] text-nb-t3 mt-0.5">
                {fmt(stats.currentShares)} 股
                {hasPrice && stats.unrealizedPnLPct !== null && (
                  <span className={`ml-2 font-bold ${pnlCls(stats.unrealizedPnLPct)}`}>
                    {fmtPct(stats.unrealizedPnLPct)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* 現價 / 損益 */}
          <div className="text-right">
            {loading ? (
              <div className="w-3 h-3 rounded-full border-2 border-nb-orange border-t-transparent animate-spin" />
            ) : hasPrice ? (
              <>
                <div className="text-[14px] font-extrabold text-nb-t0">{price}</div>
                {stats.unrealizedPnL !== null && (
                  <div className={`text-[11px] font-bold ${pnlCls(stats.unrealizedPnL)}`}>
                    {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}
                  </div>
                )}
              </>
            ) : error ? (
              <span className="text-[10px] text-nb-red">取得失敗</span>
            ) : null}
          </div>
          {/* 展開箭頭 */}
          <span className={`text-nb-t3 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {/* ── 展開內容 ── */}
      {open && (
        <div className="border-t border-nb-border">
          {/* 解套白話摘要（有現價 + 白話模式）*/}
          {!techMode && unstuck && (
            <div className={`mx-4 mt-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
              unstuck.isProfit
                ? 'bg-nb-green-bg border border-nb-green/20 text-nb-green'
                : 'bg-nb-orange-bg border border-nb-orange/20 text-nb-orange'
            }`}>
              {unstuck.summary}
            </div>
          )}

          {/* 燈號橫幅 */}
          {signal && hasPrice && stats.currentShares > 0 && (() => {
            const sp = SIGNAL_PLAIN[signal.color]
            return (
              <div className={`mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center justify-between ${
                signal.color === 'red'    ? 'bg-nb-red-bg border border-nb-red/20' :
                signal.color === 'orange' ? 'bg-nb-orange-bg border border-nb-orange/20' :
                signal.color === 'yellow' ? 'bg-nb-yellow-bg border border-nb-yellow/20' :
                                             'bg-nb-green-bg border border-nb-green/20'
              }`}>
                <div>
                  <div className={`text-[11px] font-extrabold ${
                    signal.color === 'red' ? 'text-nb-red' : signal.color === 'orange' ? 'text-nb-orange' :
                    signal.color === 'yellow' ? 'text-nb-yellow' : 'text-nb-green'
                  }`}>{techMode ? sp.techLabel : sp.label}</div>
                  <div className="text-[11px] text-nb-t2 mt-0.5 leading-snug">
                    {techMode ? sp.techLabel : sp.headDesc}
                  </div>
                </div>
                <NbBadge variant={SIG_VARIANT[signal.color]}>{signal.action}</NbBadge>
              </div>
            )
          })()}

          {/* + 新增交易按鈕 */}
          <div className="mx-4 mt-3 flex justify-end">
            <button onClick={onAddTrade}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-nb-t0 hover:opacity-80 text-nb-s0 text-[12px] font-extrabold rounded-xl transition-opacity"
            >
              <span className="text-sm leading-none">+</span>
              {techMode ? '新增交易' : '新增'}
            </button>
          </div>

          {/* Tab 列 */}
          <div className="flex border-b border-nb-border mx-4 mt-3">
            {TABS.filter(t => !t.hide).map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-[12px] font-extrabold border-b-2 transition-all flex-shrink-0 ${
                  tab === key ? 'border-nb-orange text-nb-orange' : 'border-transparent text-nb-t3 hover:text-nb-t1'
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Tab 內容 */}
          <div className="px-4 py-4">
            {tab === 'info' && <HoldingInfoTab stats={stats} techMode={techMode} />}
            {tab === 'unstuck' && hasPrice && <UnstuckProgress stats={stats} defaultView="ring" />}
            {tab === 'trim' && hasPrice && (
              <TrimCalculator
                stats={stats}
                currentPrice={price!}
                resistLevel1={sr?.resistLevel1 ?? null}
                resistLevel2={sr?.resistLevel2 ?? null}
                supportLevel1={sr?.supportLevel1 ?? null}
                stopLoss={sr?.stopLoss ?? null}
                instrumentType={stats.instrumentType}
              />
            )}
            {tab === 'timeline' && (
              <TradeTimeline trades={codeTrades} onDelete={deleteTrade} maxVisible={5} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 搜尋面板 ──────────────────────────────────────────────────
function StockSearchPanel({ onSelect, onCancel }: {
  onSelect: (
    code: string, name: string,
    price?: number,
    signal?: { color: SignalColor; label: string; action: string },
    sr?: { resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number },
    instrumentType?: InstrumentType
  ) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [sugg, setSugg] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState(false)

  const doSearch = async (v: string) => {
    setQ(v)
    if (!v.trim()) { setSugg([]); return }
    setSugg((await searchStocks(v).catch(() => [])).slice(0, 6))
  }

  const pick = async (s: SearchResult) => {
    setBusy(true)
    const instrumentType: InstrumentType = s.type === 'ETF' ? 'etf' : 'stock'
    try {
      const r = await analyzeStock(s.code)
      const sr = r.sr_result
      onSelect(s.code, s.name, r.basic.current_price, {
        color: r.decision_card.signal.color,
        label: r.decision_card.signal.label,
        action: r.decision_card.main_action,
      }, {
        resistLevel1: sr.resistance_levels[0]?.range_low  ?? undefined,
        resistLevel2: sr.resistance_levels[1]?.range_low  ?? undefined,
        supportLevel1: sr.support_levels[0]?.range_high   ?? undefined,
      }, instrumentType)
    } catch {
      onSelect(s.code, s.name, undefined, undefined, undefined, instrumentType)
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-nb-s0 border border-nb-border2 rounded-2xl shadow-nb-md p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[13px] font-extrabold text-nb-t0">新增持股</span>
        <button onClick={onCancel} className="text-nb-t3 text-2xl leading-none hover:text-nb-t1">×</button>
      </div>
      <input value={q} onChange={e => doSearch(e.target.value)}
        placeholder="輸入代號或名稱，例如 6770、台積電"
        autoFocus
        className="w-full h-11 px-3.5 bg-nb-bg border border-nb-border2 rounded-xl text-[13px] text-nb-t0 placeholder-nb-t3 focus:outline-none focus:border-nb-orange/50 mb-1"
      />
      {busy && <div className="text-[11px] text-center text-nb-t3 py-2">取得現價中…</div>}
      <div className="space-y-0.5">
        {sugg.map(s => (
          <button key={s.code} onClick={() => pick(s)}
            className="w-full flex justify-between items-center px-3.5 py-2.5 hover:bg-nb-bg rounded-xl text-[13px] transition-colors"
          >
            <span className="font-extrabold text-nb-t0">{s.code}</span>
            <span className="text-nb-t2">{s.name}</span>
            <span className="text-[10px] text-nb-t3 bg-nb-bg px-2 py-0.5 rounded-full">{s.market}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { trades, addTrade } = useTradeStore()
  const { techMode } = useUIStore()

  type LoadStatus = 'pending' | 'loading' | 'done' | 'error'
  const [statusMap, setStatusMap] = useState<Record<string, LoadStatus>>({})
  const [errorMap,  setErrorMap]  = useState<Record<string, string>>({})
  const [signalMap, setSignalMap] = useState<Record<string, { color: SignalColor; label: string; action: string }>>({})
  const [srMap,     setSrMap]     = useState<Record<string, {
    resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number
  }>>({})
  const [priceMap,  setPriceMap]  = useState<Record<string, number>>({})
  const [srAttempted, setSrAttempted] = useState<Record<string, boolean>>({})
  const { updateSignal: updateGlobalSignal } = usePortfolioSignalStore()

  const [searching,   setSearching] = useState(false)
  const [addingTrade, setAdding]    = useState<{
    code: string; name: string; price?: number; suggested: TradeType; instrumentType?: InstrumentType
  } | null>(null)

  // 持股清單（從交易紀錄推導）
  const stockList = useMemo(() => {
    const seen = new Set<string>()
    return trades.reduce<{ code: string; name: string }[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({ code: t.code, name: t.name }) }
      return acc
    }, [])
  }, [trades])

  // statsMap
  const statsMap = useMemo(() => {
    const m: Record<string, HoldingStats> = {}
    for (const { code, name } of stockList) {
      const price = priceMap[code] !== undefined ? priceMap[code] : null
      m[code] = calcHoldingStats(code, name, trades, price)
    }
    return m
  }, [stockList, trades, priceMap])

  // 總覽
  const totalValue      = Object.values(statsMap).reduce((s, x) => s + (x.currentValue ?? 0), 0)
  const totalUnrealized = Object.values(statsMap).reduce((s, x) => s + (x.unrealizedPnL ?? 0), 0)
  const totalRealized   = Object.values(statsMap).reduce((s, x) => s + x.realizedPnL, 0)
  const allLoaded       = stockList.every(({ code }) => statusMap[code] === 'done' || statusMap[code] === 'error')

  // 今日提醒：有燈號的持股，依重要性排序（紅>橙>黃>綠，同色者虧損幅度大的優先）
  const alertSignals = useMemo(() => {
    const COLOR_ORDER: Record<SignalColor, number> = { red: 0, orange: 1, yellow: 2, green: 3 }

    return stockList
      .filter(({ code }) => signalMap[code] && (statsMap[code]?.currentShares ?? 0) > 0)
      .map(({ code, name }) => {
        const sig    = signalMap[code]!
        const stats  = statsMap[code]
        const sr     = srMap[code]           // 真實支撐壓力（analyzeStock 後可用）
        const price  = stats?.currentPrice ?? priceMap[code] ?? 0

        // 真實支撐壓力（有 srMap 就用，否則不傳）
        const nearestSupport  = sr?.supportLevel1  ?? null
        const nearestResist   = sr?.resistLevel1   ?? null

        // 距支撐 / 壓力的距離比例（越近越緊急）
        // null → 尚未分析，排序時視為中等距離
        const distToSupport = (price > 0 && nearestSupport)
          ? (price - nearestSupport) / price    // 越小 = 越接近支撐（越緊急）
          : 0.1
        const distToResist  = (price > 0 && nearestResist)
          ? (nearestResist - price) / price     // 越小 = 越接近壓力（越緊急）
          : 0.1

        const oneLiner = generateOneLiner(
          sig.color,
          true,
          name,
          price,
          nearestSupport,   // 真實支撐
          nearestResist,    // 真實壓力
        )

        return {
          code,
          name,
          color:         sig.color,
          action:        oneLiner.action,
          desc:          oneLiner.reason,
          unrealizedPct: stats?.unrealizedPnLPct ?? 0,
          // 排序輔助
          _distToSupport: distToSupport,
          _distToResist:  distToResist,
          _minDist:       Math.min(distToSupport, distToResist),  // 距最近關鍵位的距離
        }
      })
      .sort((a, b) => {
        // 1. 燈號顏色優先（紅 > 橙 > 黃 > 綠）
        const colorDiff = COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
        if (colorDiff !== 0) return colorDiff
        // 2. 同色：距關鍵位（支撐或壓力）越近越優先
        const distDiff = a._minDist - b._minDist
        if (Math.abs(distDiff) > 0.005) return distDiff
        // 3. 同色同距：虧損越深排越前
        return (a.unrealizedPct ?? 0) - (b.unrealizedPct ?? 0)
      })
      // 回傳前移除排序輔助欄位（TodayAlertBanner 不需要）
      .map(({ _distToSupport: _d1, _distToResist: _d2, _minDist: _m, ...rest }) => rest)
  }, [stockList, signalMap, statsMap, srMap, priceMap])

  // fetchAnalysis（保留所有邏輯）
  const fetchAnalysis = useCallback((code: string) => {
    setStatusMap(m => ({ ...m, [code]: 'loading' }))
    analyzeStock(code)
      .then(r => {
        console.log(`[analyzeStock:${code}]`, {
          resistance_levels: r.decision_card.resistance_levels,
          support_levels:    r.decision_card.support_levels,
          stop_loss:         r.decision_card.stop_loss,
        })
        const p = r.basic.current_price
        if (!p || p <= 0) throw new Error('回傳現價無效')
        setPriceMap( m => ({ ...m, [code]: p }))
        setStatusMap(m => ({ ...m, [code]: 'done' }))
        setErrorMap( m => { const n = { ...m }; delete n[code]; return n })
        setSignalMap(m => ({ ...m, [code]: {
          color:  r.decision_card.signal.color,
          label:  r.decision_card.signal.label,
          action: r.decision_card.main_action,
        }}))
        // 同步寫入全域 store，供首頁生成個人化今日筆記
        const holdingSt = statsMap[code]
        updateGlobalSignal({
          code,
          name:             stockList.find(s => s.code === code)?.name ?? code,
          color:            r.decision_card.signal.color,
          action:           r.decision_card.main_action,
          currentShares:    holdingSt?.currentShares ?? 0,
          unrealizedPnLPct: holdingSt?.unrealizedPnLPct ?? null,
        })
        const resLevels = r.decision_card.resistance_levels
        const supLevels = r.decision_card.support_levels
        const res1 = resLevels.find(l => l.rank === 1) ?? resLevels[0]
        const res2 = resLevels.find(l => l.rank === 2) ?? resLevels[1]
        const sup1 = supLevels.find(l => l.rank === 1) ?? supLevels[0]
        setSrMap(m => ({ ...m, [code]: {
          resistLevel1:  res1?.range_low  ?? undefined,
          resistLevel2:  res2?.range_low  ?? undefined,
          supportLevel1: sup1?.range_high ?? undefined,
          stopLoss:      r.decision_card.stop_loss ?? undefined,
        }}))
        setSrAttempted(m => ({ ...m, [code]: true }))
      })
      .catch(err => {
        getStockBasic(code)
          .then(data => {
            const p = data.current_price
            if (!p || p <= 0) throw new Error('現價無效')
            setPriceMap( m => ({ ...m, [code]: p }))
            setStatusMap(m => ({ ...m, [code]: 'done' }))
            setSrAttempted(m => ({ ...m, [code]: true }))
          })
          .catch(() => {
            const msg = err instanceof Error ? err.message : '無法取得現價'
            setErrorMap( m => ({ ...m, [code]: msg }))
            setStatusMap(m => ({ ...m, [code]: 'error' }))
            setSrAttempted(m => ({ ...m, [code]: true }))
          })
      })
  }, [])

  useEffect(() => {
    if (stockList.length === 0) return
    for (const { code } of stockList) {
      const status = statusMap[code]
      if (status === 'done' || status === 'loading') continue
      fetchAnalysis(code)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockList])

  const handleSelectStock = useCallback((
    code: string, name: string,
    price?: number,
    signal?: { color: SignalColor; label: string; action: string },
    sr?: { resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number },
    instrumentType?: InstrumentType
  ) => {
    setSearching(false)
    if (price && price > 0) {
      setPriceMap( m => ({ ...m, [code]: price }))
      setStatusMap(m => ({ ...m, [code]: 'done' }))
    }
    if (signal) setSignalMap(m => ({ ...m, [code]: signal }))
    if (sr)     setSrMap(    m => ({ ...m, [code]: sr }))
    setAdding({ code, name, price, suggested: suggestTradeType(code, trades, 'buy'), instrumentType })
  }, [trades])

  const handleAddFor = useCallback((code: string, name: string) => {
    setAdding({
      code, name,
      price: priceMap[code],
      suggested: suggestTradeType(code, trades, 'buy'),
      instrumentType: statsMap[code]?.instrumentType,
    })
  }, [trades, priceMap, statsMap])

  const handleSave = useCallback((tradeData: any) => {
    if (!addingTrade) return
    addTrade({ ...tradeData, code: addingTrade.code, name: addingTrade.name,
      instrumentType: addingTrade.instrumentType ?? 'stock' })
    setAdding(null)
  }, [addingTrade, addTrade])

  return (
    <div className="min-h-screen bg-nb-bg">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 標題列 */}
        <div className="flex justify-between items-center">
          <h1 className="text-[22px] font-black text-nb-t0 tracking-tight">
            {techMode ? '持股管理' : '我的持股'}
          </h1>
          <button onClick={() => setSearching(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-nb-t0 hover:opacity-80 text-nb-s0 text-[13px] font-extrabold rounded-2xl transition-opacity"
          >
            <span className="text-base leading-none">+</span> 新增持股
          </button>
        </div>

        {/* ① 今日 AI 提醒（最上方，主角）*/}
        {alertSignals.length > 0 && (
          <TodayAlertBanner signals={alertSignals} techMode={techMode} />
        )}

        {/* ② 總覽卡（次要）*/}
        {stockList.length > 0 && (
          <div className="bg-gradient-to-br from-nb-t0 to-[#1A1510] rounded-2xl p-4 shadow-nb-md">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-nb-t3 font-extrabold tracking-widest">
                {techMode ? '投資組合總覽' : '我的持股概況'}
              </div>
              {!allLoaded && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-nb-orange border-t-transparent animate-spin" />
                  <span className="text-[10px] text-nb-t3">現價更新中…</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: techMode ? '目前市值' : '現在值多少', v: allLoaded ? `$${fmt(totalValue)}` : '載入中', c: 'text-white' },
                { l: techMode ? '未實現損益' : '目前損益',
                  v: allLoaded ? `${totalUnrealized >= 0 ? '+' : ''}${fmt(totalUnrealized)}` : '—',
                  c: totalUnrealized >= 0 ? 'text-nb-up' : 'text-nb-down' },
                { l: techMode ? '已實現損益' : '賣出有賺',
                  v: totalRealized !== 0 ? `${totalRealized >= 0 ? '+' : ''}${fmt(totalRealized)}` : '—',
                  c: totalRealized >= 0 ? 'text-nb-up' : 'text-nb-down' },
              ].map(({ l, v, c }) => (
                <div key={l} className="text-center">
                  <div className="text-[9px] text-nb-t3 mb-1 font-bold">{l}</div>
                  <div className={`text-[15px] font-extrabold ${c} leading-tight`}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搜尋面板 */}
        {searching && (
          <StockSearchPanel onSelect={handleSelectStock} onCancel={() => setSearching(false)} />
        )}

        {/* 新增交易表單 */}
        {addingTrade && (
          <TradeForm
            code={addingTrade.code}
            name={addingTrade.name}
            currentPrice={addingTrade.price}
            suggestedType={addingTrade.suggested}
            onSave={handleSave}
            onCancel={() => setAdding(null)}
          />
        )}

        {/* ③ 持股 Accordion 列表 */}
        {stockList.length > 0 ? (
          <div className="space-y-2.5">
            {stockList.map(({ code, name }) => (
              <HoldingCard
                key={code}
                stats={statsMap[code]}
                loading={statusMap[code] === 'loading' || statusMap[code] === 'pending' || statusMap[code] === undefined}
                error={statusMap[code] === 'error' ? (errorMap[code] ?? '取得失敗') : null}
                signal={signalMap[code]}
                sr={srMap[code]}
                srAttempted={srAttempted[code]}
                onRetryAnalysis={() => fetchAnalysis(code)}
                onAddTrade={() => handleAddFor(code, name)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-nb-s0 border border-nb-border rounded-3xl shadow-nb p-8 text-center">
            <div className="w-16 h-16 bg-nb-s2 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">📋</div>
            <div className="text-[15px] font-extrabold text-nb-t0 mb-2">
              {techMode ? '尚無持股紀錄' : '還沒有持股紀錄'}
            </div>
            <div className="text-[12px] text-nb-t3 leading-relaxed">
              {techMode ? '點擊右上角「新增持股」開始記錄' : '點右上角按鈕，記錄你的第一筆交易'}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
