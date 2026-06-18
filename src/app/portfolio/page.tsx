'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTradeStore, calcHoldingStats, suggestTradeType } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { getStockBasic, analyzeStock, searchStocks } from '@/lib/api'
import { generateUnstuckText, SIGNAL_PLAIN } from '@/lib/plain-talk'
import type { SearchResult, HoldingStats, TradeType, SignalColor } from '@/types'
import { TRADE_META } from '@/types'
import TradeForm from '@/components/cards/TradeForm'
import TradeTimeline from '@/components/cards/TradeTimeline'
import UnstuckProgress from '@/components/ui/UnstuckProgress'
import TrimCalculator from '@/components/ui/TrimCalculator'

// ── 燈號樣式 ─────────────────────────────────────────────────
const SIG_STYLE: Record<SignalColor, {
  border: string; bg: string; text: string; badge: string
}> = {
  green:  { border: 'border-l-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-500 text-white' },
  yellow: { border: 'border-l-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-400 text-white'   },
  orange: { border: 'border-l-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-500 text-white'  },
  red:    { border: 'border-l-red-400',     bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-500 text-white'     },
}

// ── 工具函數 ─────────────────────────────────────────────────
const fmt    = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

// 只對非 null 的數值套色，null 回傳中性色
const pnlCls = (n: number | null) =>
  n === null ? 'text-stone-400'
  : n > 0  ? 'text-red-500'
  : n < 0  ? 'text-emerald-600'
  : 'text-stone-400'

const pnlBgCls = (n: number | null) =>
  n === null ? 'bg-stone-50 text-stone-400 border-stone-200'
  : n > 0  ? 'bg-red-50 text-red-600 border-red-100'
  : n < 0  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
  : 'bg-stone-50 text-stone-500 border-stone-200'

// ── 持股卡頂部 ───────────────────────────────────────────────
function HoldingHeader({ stats, loading, error, onAdd }: {
  stats: HoldingStats        // stats 中的現價相關欄位可能為 null
  loading: boolean
  error: string | null
  onAdd: () => void
}) {
  const { techMode } = useUIStore()

  // 從 stats 取出（可能為 null）
  const price    = stats.currentPrice
  const hasPrice = price !== null && price > 0

  // 解套文字（只在有現價時生成）
  const unstuck = hasPrice && stats.currentShares > 0 && stats.distanceToBreakeven !== null
    ? generateUnstuckText(
        stats.avgCost, price!,
        stats.currentShares,
        stats.distanceToBreakeven!
      )
    : null

  return (
    <div className="px-4 pt-4 pb-0">
      {/* 名稱列 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-extrabold text-stone-900">{stats.name}</span>
            <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full font-medium">
              {stats.code}
            </span>
            {stats.currentShares > 0 && (
              <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                {fmt(stats.currentShares)} 股
              </span>
            )}
          </div>

          {/* 狀態行：正在載入 / 錯誤 / 現價 + 損益 */}
          {loading && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <span className="text-xs text-stone-400">正在取得最新價格…</span>
            </div>
          )}
          {!loading && error && (
            <div className="mt-1.5 text-xs text-red-400">⚠ {error}</div>
          )}
          {hasPrice && !loading && stats.currentShares > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-stone-400">現價 {price}</span>
              {stats.unrealizedPnL !== null && stats.unrealizedPnLPct !== null && (
                <span className={`text-sm font-bold ${pnlCls(stats.unrealizedPnL)}`}>
                  {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}
                  （{fmtPct(stats.unrealizedPnLPct)}）
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={onAdd}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors"
        >
          <span className="text-sm leading-none">+</span> 新增
        </button>
      </div>

      {/* 損益三欄：只在有現價時顯示，null 欄位顯示「—」 */}
      {stats.currentShares > 0 && (
        hasPrice ? (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {/* 損益 */}
            <div className={`rounded-xl border p-2.5 text-center ${pnlBgCls(stats.unrealizedPnL)}`}>
              <div className="text-[9px] font-bold opacity-70 mb-0.5">
                {techMode ? '未實現損益'
                  : stats.unrealizedPnL !== null && stats.unrealizedPnL >= 0 ? '目前獲利' : '目前虧損'}
              </div>
              <div className="text-sm font-extrabold leading-tight">
                {stats.unrealizedPnL !== null
                  ? `${stats.unrealizedPnL >= 0 ? '+' : ''}${fmt(stats.unrealizedPnL)}`
                  : '—'}
              </div>
              <div className="text-[9px] mt-0.5 opacity-80">
                {stats.unrealizedPnLPct !== null ? fmtPct(stats.unrealizedPnLPct) : ''}
              </div>
            </div>
            {/* 市值 */}
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-center">
              <div className="text-[9px] font-bold text-stone-400 mb-0.5">
                {techMode ? '目前市值' : '現在值多少'}
              </div>
              <div className="text-sm font-extrabold text-stone-700">
                {stats.currentValue !== null ? `$${fmt(stats.currentValue)}` : '—'}
              </div>
              <div className="text-[9px] text-stone-400 mt-0.5">成本 {stats.avgCost}</div>
            </div>
            {/* 已實現 */}
            <div className={`rounded-xl border p-2.5 text-center ${
              stats.realizedPnL !== 0 ? pnlBgCls(stats.realizedPnL) : 'bg-stone-50 border-stone-100'
            }`}>
              <div className="text-[9px] font-bold opacity-70 mb-0.5">
                {techMode ? '已實現損益' : '賣出有賺'}
              </div>
              <div className="text-sm font-extrabold">
                {stats.realizedPnL !== 0
                  ? `${stats.realizedPnL >= 0 ? '+' : ''}${fmt(stats.realizedPnL)}`
                  : <span className="text-stone-400">—</span>}
              </div>
            </div>
          </div>
        ) : (
          /* 尚無現價：顯示佔位，明確告知正在取得 */
          <div className="mb-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 flex items-center gap-2">
            {loading
              ? <><div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin flex-shrink-0" />
                  <span className="text-xs text-stone-400">正在取得最新價格，損益計算中…</span></>
              : <span className="text-xs text-stone-400">
                  {error ?? '無法取得現價，請稍後再試'}
                </span>
            }
          </div>
        )
      )}

      {/* 解套白話摘要（有現價 + 白話模式）*/}
      {!techMode && unstuck && !unstuck.isProfit && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-3 text-xs text-amber-800 leading-relaxed">
          {unstuck.summary}
        </div>
      )}
      {!techMode && unstuck?.isProfit && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-3 text-xs text-emerald-700 leading-relaxed">
          {unstuck.summary}
        </div>
      )}
    </div>
  )
}

// ── 持股詳細 Tab ─────────────────────────────────────────────
function HoldingInfoTab({ stats, techMode }: {
  stats: HoldingStats; techMode: boolean
}) {
  const price = stats.currentPrice
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {[
          { l: techMode ? '加權平均成本' : '我的買進成本',
            v: `${stats.avgCost} 元` },
          { l: techMode ? '最近買進價' : '最近一次買進',
            v: stats.latestBuyPrice != null ? `${stats.latestBuyPrice} 元` : '—' },
          { l: techMode ? '持股股數' : '我持有多少股',
            v: `${fmt(stats.currentShares)} 股（${Math.floor(stats.currentShares / 1000)} 張）` },
          { l: techMode ? '最近賣出價' : '最近一次賣出',
            v: stats.latestSellPrice != null ? `${stats.latestSellPrice} 元` : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div className="text-[10px] text-stone-400 mb-0.5">{l}</div>
            <div className="text-sm font-bold text-stone-800">{v}</div>
          </div>
        ))}
      </div>
      {/* 損益三格（全部 null-safe）*/}
      <div className="pt-2 border-t border-stone-100 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-stone-400 mb-1">
            {techMode ? '未實現損益' : '目前損益'}
          </div>
          <div className={`text-sm font-extrabold ${pnlCls(stats.unrealizedPnL)}`}>
            {stats.unrealizedPnL !== null
              ? `${stats.unrealizedPnL >= 0 ? '+' : ''}${fmt(stats.unrealizedPnL)}`
              : '—'}
          </div>
          {stats.unrealizedPnLPct !== null && (
            <div className={`text-[10px] mt-0.5 ${pnlCls(stats.unrealizedPnLPct)}`}>
              {fmtPct(stats.unrealizedPnLPct)}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] text-stone-400 mb-1">
            {techMode ? '目前市值' : '現在值多少'}
          </div>
          <div className="text-sm font-extrabold text-stone-700">
            {stats.currentValue !== null ? `$${fmt(stats.currentValue)}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-stone-400 mb-1">
            {techMode ? '已實現損益' : '賣出後有賺'}
          </div>
          <div className={`text-sm font-extrabold ${pnlCls(stats.realizedPnL)}`}>
            {stats.realizedPnL !== 0
              ? `${stats.realizedPnL >= 0 ? '+' : ''}${fmt(stats.realizedPnL)}`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 單檔持股大卡 ─────────────────────────────────────────────
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
  const [tab, setTab] = useState<CardTab>('info')
  const { trades, deleteTrade } = useTradeStore()
  const { techMode } = useUIStore()
  const codeTrades = trades.filter(t => t.code === stats.code)

  // 從 stats 取出現價（可能 null）
  const price    = stats.currentPrice
  const hasPrice = price !== null && price > 0

  const TABS: { key: CardTab; label: string; hide?: boolean }[] = [
    { key: 'info',     label: techMode ? '持股資訊' : '資訊' },
    { key: 'unstuck',
      label: techMode ? '解套進度' : '回本進度',
      hide: !hasPrice || stats.isProfit === true },
    { key: 'trim',
      label: techMode ? '減碼試算' : '賣多少',
      hide: !hasPrice || stats.currentShares === 0 },
    { key: 'timeline', label: `紀錄（${codeTrades.length}）` },
  ]

  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-md overflow-hidden">
      {/* 持股頂部（loading/error/現價 由此元件自行判斷顯示）*/}
      <HoldingHeader stats={stats} loading={loading} error={error} onAdd={onAddTrade} />

      {/* 燈號橫幅（有燈號 + 有現價 + 有持股）*/}
      {signal && hasPrice && stats.currentShares > 0 && (() => {
        const sty = SIG_STYLE[signal.color]
        const sp  = SIGNAL_PLAIN[signal.color]
        return (
          <div className={`mx-4 mb-3 rounded-2xl border-l-4 px-4 py-3 flex items-center justify-between ${sty.bg} ${sty.border}`}>
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{sp.emoji}</span>
              <div>
                <div className={`text-xs font-extrabold ${sty.text}`}>{signal.label}</div>
                <div className={`text-[10px] ${sty.text} opacity-70 mt-0.5`}>{sp.headDesc}</div>
              </div>
            </div>
            <div className={`text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm ${sty.badge}`}>
              {signal.action}
            </div>
          </div>
        )
      })()}

      {/* 智慧減碼提示（橘 / 紅燈 + 有現價）*/}
      {signal && (signal.color === 'orange' || signal.color === 'red')
        && hasPrice && stats.currentShares > 0 && (() => {
        const ratio   = signal.color === 'red' ? 1.0 : 0.3
        const sell    = Math.floor(stats.currentShares * ratio)
        const keep    = stats.currentShares - sell
        const recover = sell * price!
        return (
          <div className="mx-4 mb-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
            <div className="text-[10px] font-extrabold text-orange-600 tracking-wider mb-2">
              💡 建議操作參考（{Math.round(ratio * 100)}% 減碼）
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: '建議賣出', v: `${sell} 股` },
                { l: '保留股數', v: `${keep} 股` },
                { l: '預估回收', v: `$${fmt(recover)}` },
              ].map(({ l, v }) => (
                <div key={l} className="bg-white rounded-xl p-2 border border-orange-100">
                  <div className="text-[9px] text-stone-400 mb-0.5">{l}</div>
                  <div className="text-sm font-extrabold text-orange-700">{v}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-orange-500 mt-2 text-center">
              詳細試算請點「{techMode ? '減碼試算' : '賣多少'}」頁籤
            </div>
          </div>
        )
      })()}

      {/* Tab 列 */}
      <div className="flex border-b border-stone-100 mx-4">
        {TABS.filter(t => !t.hide).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex-shrink-0 ${
              tab === key
                ? 'border-amber-400 text-amber-600'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Tab 內容 */}
      <div className="px-4 py-4">
        {tab === 'info' && (
          <HoldingInfoTab stats={stats} techMode={techMode} />
        )}
        {tab === 'unstuck' && hasPrice && (
          <UnstuckProgress stats={stats} defaultView="ring" />
        )}
        {tab === 'trim' && hasPrice && (
          <TrimCalculator
            stats={stats}
            currentPrice={price!}
            resistLevel1={sr?.resistLevel1 ?? null}
            resistLevel2={sr?.resistLevel2 ?? null}
            supportLevel1={sr?.supportLevel1 ?? null}
            stopLoss={sr?.stopLoss ?? null}
          />
        )}
        {tab === 'timeline' && (
          <TradeTimeline trades={codeTrades} onDelete={deleteTrade} maxVisible={5} />
        )}
      </div>
    </div>
  )
}

// ── 股票搜尋面板 ─────────────────────────────────────────────
function StockSearchPanel({ onSelect, onCancel }: {
  onSelect: (
    code: string, name: string,
    price?: number,
    signal?: { color: SignalColor; label: string; action: string },
    sr?: { resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number }
  ) => void
  onCancel: () => void
}) {
  const [q, setQ]       = useState('')
  const [sugg, setSugg] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState(false)

  const doSearch = async (v: string) => {
    setQ(v)
    if (!v.trim()) { setSugg([]); return }
    setSugg((await searchStocks(v).catch(() => [])).slice(0, 6))
  }

  const pick = async (s: SearchResult) => {
    setBusy(true)
    try {
      const r = await analyzeStock(s.code)
      const sr = r.sr_result
      onSelect(s.code, s.name, r.basic.current_price, {
        color:  r.decision_card.signal.color,
        label:  r.decision_card.signal.label,
        action: r.decision_card.main_action,
      }, {
        resistLevel1:  sr.resistance_levels[0]?.range_low  ?? undefined,
        resistLevel2:  sr.resistance_levels[1]?.range_low  ?? undefined,
        supportLevel1: sr.support_levels[0]?.range_high    ?? undefined,
      })
    } catch {
      onSelect(s.code, s.name)
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-extrabold text-stone-700">新增持股</span>
        <button onClick={onCancel} className="text-stone-400 text-2xl leading-none hover:text-stone-600">×</button>
      </div>
      <input value={q} onChange={e => doSearch(e.target.value)}
        placeholder="輸入代號或名稱，例如 6770、台積電"
        autoFocus
        className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 mb-1"
      />
      {busy && <div className="text-xs text-center text-stone-400 py-2">取得現價中…</div>}
      <div className="space-y-0.5">
        {sugg.map(s => (
          <button key={s.code} onClick={() => pick(s)}
            className="w-full flex justify-between items-center px-3.5 py-2.5 hover:bg-stone-50 rounded-xl text-sm transition-colors"
          >
            <span className="font-extrabold text-stone-700">{s.code}</span>
            <span className="text-stone-500">{s.name}</span>
            <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{s.market}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function PortfolioPage() {
  const { trades, addTrade } = useTradeStore()
  const { techMode }         = useUIStore()

  // ── 現價載入狀態（所有依賴現價的運算都從這裡出發）────────
  type LoadStatus = 'pending' | 'loading' | 'done' | 'error'
  const [statusMap, setStatusMap] = useState<Record<string, LoadStatus>>({})
  const [errorMap,  setErrorMap]  = useState<Record<string, string>>({})
  const [signalMap, setSignalMap] = useState<Record<string, { color: SignalColor; label: string; action: string }>>({})
  // SR 目標價格（第一壓力、第二壓力、第一支撐、停損），由 analyzeStock 填充
  const [srMap, setSrMap] = useState<Record<string, {
    resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number
  }>>({})

  // ── 現價 Map：明確區分 null（未取得）和數值 ───────────────
  const [priceMap, setPriceMap] = useState<Record<string, number>>({})

  // ── UI 狀態 ───────────────────────────────────────────────
  const [searching,   setSearching] = useState(false)
  const [addingTrade, setAdding]    = useState<{
    code: string; name: string; price?: number; suggested: TradeType
  } | null>(null)

  // ── 從交易紀錄推導持股清單 ────────────────────────────────
  const stockList = useMemo(() => {
    const seen = new Set<string>()
    return trades.reduce<{ code: string; name: string }[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({ code: t.code, name: t.name }) }
      return acc
    }, [])
  }, [trades])

  // ── 統計計算：現價 null → calcHoldingStats 收到 null，不會算出假性數值 ──
  const statsMap = useMemo(() => {
    const m: Record<string, HoldingStats> = {}
    for (const { code, name } of stockList) {
      // ✅ 關鍵：沒有現價時傳 null，不傳 0
      const price = priceMap[code] !== undefined ? priceMap[code] : null
      m[code] = calcHoldingStats(code, name, trades, price)
    }
    return m
  }, [stockList, trades, priceMap])

  // ── 總覽（null-safe，未取得的不計入）────────────────────
  const totalValue      = Object.values(statsMap).reduce((s, x) => s + (x.currentValue ?? 0), 0)
  const totalUnrealized = Object.values(statsMap).reduce((s, x) => s + (x.unrealizedPnL ?? 0), 0)
  const totalRealized   = Object.values(statsMap).reduce((s, x) => s + x.realizedPnL, 0)
  const allLoaded       = stockList.every(({ code }) => statusMap[code] === 'done' || statusMap[code] === 'error')

  // SR 嘗試狀態：分辨「還沒分析」vs「分析過但無壓力位」
  const [srAttempted, setSrAttempted] = useState<Record<string, boolean>>({})

  // 取得單一股票的完整分析（現價 + 燈號 + 壓力支撐），可重複呼叫供「重新分析」按鈕使用
  const fetchAnalysis = useCallback((code: string) => {
    setStatusMap(m => ({ ...m, [code]: 'loading' }))

    analyzeStock(code)
      .then(r => {
        // 除錯用：印出實際 analyze API 回應，確認後端真實資料結構
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
        // 依 rank 篩選，確保語意正確（陣列順序不一定等於 rank 順序）
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
        // analyzeStock 失敗時 fallback 到輕量 getStockBasic（至少拿到現價）
        getStockBasic(code)
          .then(data => {
            const p = data.current_price
            if (!p || p <= 0) throw new Error('現價無效')
            setPriceMap( m => ({ ...m, [code]: p }))
            setStatusMap(m => ({ ...m, [code]: 'done' }))
            // srMap 維持 undefined → UI 顯示「重新分析」按鈕，而非永遠卡住
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

  // ── 頁面掛載後自動取得所有持股現價 ──────────────────────
  useEffect(() => {
    if (stockList.length === 0) return
    for (const { code } of stockList) {
      const status = statusMap[code]
      if (status === 'done' || status === 'loading') continue
      fetchAnalysis(code)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockList])
  // 注意：不把 statusMap 加進依賴，避免取得結果後觸發無限迴圈。
  // 用 status === 'loading' | 'done' 的判斷防止重複發請求。

  // ── handlers ─────────────────────────────────────────────
  const handleSelectStock = useCallback((
    code: string, name: string,
    price?: number,
    signal?: { color: SignalColor; label: string; action: string },
    sr?: { resistLevel1?: number; resistLevel2?: number; supportLevel1?: number; stopLoss?: number }
  ) => {
    setSearching(false)
    if (price && price > 0) {
      setPriceMap( m => ({ ...m, [code]: price }))
      setStatusMap(m => ({ ...m, [code]: 'done' }))
    }
    if (signal) setSignalMap(m => ({ ...m, [code]: signal }))
    if (sr)     setSrMap(    m => ({ ...m, [code]: sr }))
    setAdding({ code, name, price, suggested: suggestTradeType(code, trades, 'buy') })
  }, [trades])

  const handleAddFor = useCallback((code: string, name: string) => {
    setAdding({
      code, name,
      price: priceMap[code],
      suggested: suggestTradeType(code, trades, 'buy'),
    })
  }, [trades, priceMap])

  const handleSave = useCallback((tradeData: any) => {
    if (!addingTrade) return
    addTrade({ ...tradeData, code: addingTrade.code, name: addingTrade.name })
    setAdding(null)
  }, [addingTrade, addTrade])

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 標題列 */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-extrabold text-stone-900">
            {techMode ? '持股管理' : '我的持股'}
          </h1>
          <button onClick={() => setSearching(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-extrabold rounded-xl shadow-sm transition-colors"
          >
            <span className="text-base leading-none">+</span> 新增持股
          </button>
        </div>

        {/* 總覽卡 */}
        {stockList.length > 0 && (
          <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-stone-400 font-bold tracking-widest">投資組合總覽</div>
              {!allLoaded && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  <span className="text-[10px] text-stone-500">現價更新中…</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: techMode ? '目前市值' : '現在值多少',
                  v: allLoaded ? `$${fmt(totalValue)}` : '載入中',
                  c: 'text-white' },
                { l: techMode ? '未實現損益' : '目前損益',
                  v: allLoaded ? `${totalUnrealized >= 0 ? '+' : ''}${fmt(totalUnrealized)}` : '—',
                  c: totalUnrealized >= 0 ? 'text-red-400' : 'text-emerald-400' },
                { l: techMode ? '已實現損益' : '賣出有賺',
                  v: totalRealized !== 0 ? `${totalRealized >= 0 ? '+' : ''}${fmt(totalRealized)}` : '—',
                  c: totalRealized >= 0 ? 'text-red-400' : 'text-emerald-400' },
              ].map(({ l, v, c }) => (
                <div key={l} className="text-center">
                  <div className="text-[9px] text-stone-500 mb-1 font-medium">{l}</div>
                  <div className={`text-base font-extrabold ${c} leading-tight`}>{v}</div>
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

        {/* 持股大卡列表 */}
        {stockList.length > 0 ? (
          stockList.map(({ code, name }) => (
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
          ))
        ) : (
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">📋</div>
            <div className="text-base font-extrabold text-stone-600 mb-2">
              {techMode ? '尚無持股紀錄' : '還沒有持股紀錄'}
            </div>
            <div className="text-xs text-stone-400 leading-relaxed">
              {techMode ? '點擊右上角「新增持股」開始記錄' : '點右上角按鈕，記錄你的第一筆交易'}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
