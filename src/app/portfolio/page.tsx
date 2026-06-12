'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTradeStore, calcHoldingStats, suggestTradeType } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { analyzeStock, searchStocks } from '@/lib/api'
import { generateUnstuckText, SIGNAL_PLAIN } from '@/lib/plain-talk'
import type { SearchResult, HoldingStats, TradeType, SignalColor } from '@/types'
import { TRADE_META } from '@/types'

// 燈號樣式對照
const SIG_STYLE: Record<SignalColor, { border: string; bg: string; text: string; badge: string }> = {
  green:  { border: 'border-l-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-500 text-white' },
  yellow: { border: 'border-l-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-400 text-white'   },
  orange: { border: 'border-l-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-500 text-white'  },
  red:    { border: 'border-l-red-400',     bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-500 text-white'     },
}
import TradeForm from '@/components/cards/TradeForm'
import TradeTimeline from '@/components/cards/TradeTimeline'
import UnstuckProgress from '@/components/ui/UnstuckProgress'
import TrimCalculator from '@/components/ui/TrimCalculator'

const fmt      = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtPct   = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const pnlCls   = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-emerald-600' : 'text-stone-400'
const pnlBgCls = (n: number) => n > 0 ? 'bg-red-50 text-red-600 border-red-100'
                               : n < 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                               : 'bg-stone-100 text-stone-500 border-stone-200'

// ── 持股摘要卡（卡片頂部）────────────────────────────────────
function HoldingHeader({ stats, price, onAdd }: {
  stats: HoldingStats; price: number | null; onAdd: () => void
}) {
  const { techMode } = useUIStore()
  const px = price ?? 0
  const hasPrice = px > 0

  const unstuck = hasPrice
    ? generateUnstuckText(stats.avgCost, px, stats.currentShares, stats.distanceToBreakeven)
    : null

  return (
    <div className="px-4 pt-4 pb-0">
      {/* 名稱 + 新增按鈕 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-extrabold text-stone-900">{stats.name}</span>
            <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full font-medium">{stats.code}</span>
            {stats.currentShares > 0 && (
              <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                {fmt(stats.currentShares)} 股
              </span>
            )}
          </div>
          {hasPrice && stats.currentShares > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-stone-400">現價 {px}</span>
              <span className={`text-sm font-bold ${pnlCls(stats.unrealizedPnL)}`}>
                {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}（{fmtPct(stats.unrealizedPnLPct)}）
              </span>
            </div>
          )}
        </div>
        <button onClick={onAdd}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors"
        >
          <span className="text-sm leading-none">+</span> 新增
        </button>
      </div>

      {/* 損益三欄 */}
      {stats.currentShares > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className={`rounded-xl border p-2.5 text-center ${pnlBgCls(stats.unrealizedPnL)}`}>
            <div className="text-[9px] font-bold opacity-70 mb-0.5">
              {techMode ? '未實現損益' : (stats.unrealizedPnL >= 0 ? '目前獲利' : '目前虧損')}
            </div>
            <div className="text-sm font-extrabold leading-tight">
              {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}
            </div>
            <div className="text-[9px] mt-0.5 opacity-80">{fmtPct(stats.unrealizedPnLPct)}</div>
          </div>
          <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-center">
            <div className="text-[9px] font-bold text-stone-400 mb-0.5">
              {techMode ? '目前市值' : '現在值多少'}
            </div>
            <div className="text-sm font-extrabold text-stone-700">${fmt(stats.currentValue)}</div>
            <div className="text-[9px] text-stone-400 mt-0.5">成本 {stats.avgCost}</div>
          </div>
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
      )}

      {/* 解套文字摘要（白話模式 + 虧損才顯示）*/}
      {!techMode && unstuck && !unstuck.isProfit && stats.currentShares > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-3 text-xs text-amber-800 leading-relaxed">
          {unstuck.summary}
        </div>
      )}
      {!techMode && unstuck?.isProfit && stats.currentShares > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-3 text-xs text-emerald-700 leading-relaxed">
          {unstuck.summary}
        </div>
      )}
    </div>
  )
}

// ── 持股資訊詳細（持股頁 tab 用）────────────────────────────
function HoldingInfoTab({ stats, price, techMode }: {
  stats: HoldingStats; price: number; techMode: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {[
          { l: techMode ? '加權平均成本' : '我的買進成本',   v: `${stats.avgCost} 元` },
          { l: techMode ? '最近買進價'   : '最近一次買進',   v: stats.latestBuyPrice  != null ? `${stats.latestBuyPrice} 元`  : '—' },
          { l: techMode ? '持股股數'     : '我持有多少股',   v: `${fmt(stats.currentShares)} 股（${Math.floor(stats.currentShares/1000)} 張）` },
          { l: techMode ? '最近賣出價'   : '最近一次賣出',   v: stats.latestSellPrice != null ? `${stats.latestSellPrice} 元` : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div className="text-[10px] text-stone-400 mb-0.5">{l}</div>
            <div className="text-sm font-bold text-stone-800">{v}</div>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-stone-100 grid grid-cols-3 gap-2 text-center">
        {[
          { l: techMode ? '未實現損益' : '目前損益',  v: `${stats.unrealizedPnL >= 0 ? '+' : ''}${fmt(stats.unrealizedPnL)}`, sub: fmtPct(stats.unrealizedPnLPct), c: pnlCls(stats.unrealizedPnL) },
          { l: techMode ? '目前市值'   : '現在值多少', v: `$${fmt(stats.currentValue)}`, sub: '', c: 'text-stone-700' },
          { l: techMode ? '已實現損益' : '賣出後有賺', v: stats.realizedPnL !== 0 ? `${stats.realizedPnL >= 0 ? '+' : ''}${fmt(stats.realizedPnL)}` : '—', sub: '', c: pnlCls(stats.realizedPnL) },
        ].map(({ l, v, sub, c }) => (
          <div key={l}>
            <div className="text-[10px] text-stone-400 mb-1">{l}</div>
            <div className={`text-sm font-extrabold ${c}`}>{v}</div>
            {sub && <div className={`text-[10px] mt-0.5 ${c}`}>{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 單檔持股大卡 ─────────────────────────────────────────────
type CardTab = 'info' | 'unstuck' | 'trim' | 'timeline'

function HoldingCard({ stats, price, signal, onRefresh, onAddTrade }: {
  stats: HoldingStats
  price: number | null
  signal?: { color: SignalColor; label: string; action: string }
  onRefresh: () => void
  onAddTrade: () => void
}) {
  const [tab, setTab] = useState<CardTab>('info')
  const { trades, deleteTrade } = useTradeStore()
  const { techMode } = useUIStore()
  const codeTrades = trades.filter(t => t.code === stats.code)
  const px = price ?? 0
  const hasPrice = px > 0

  const TABS: { key: CardTab; label: string; hide?: boolean }[] = [
    { key: 'info',     label: techMode ? '持股資訊' : '資訊' },
    { key: 'unstuck',  label: techMode ? '解套進度' : '回本進度', hide: stats.isProfit && stats.currentShares > 0 },
    { key: 'trim',     label: techMode ? '減碼試算' : '賣多少', hide: !hasPrice || stats.currentShares === 0 },
    { key: 'timeline', label: `紀錄（${codeTrades.length}）` },
  ]

  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-md overflow-hidden">
      <HoldingHeader stats={stats} price={price} onAdd={onAddTrade} />

      {/* 燈號橫幅 */}
      {signal && stats.currentShares > 0 && (() => {
        const sty = SIG_STYLE[signal.color]
        const sp  = SIGNAL_PLAIN[signal.color]
        return (
          <div className={`mx-4 mb-3 rounded-2xl border-l-4 px-4 py-3 flex items-center justify-between ${sty.bg} ${sty.border}`}>
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{sp.emoji}</span>
              <div>
                <div className={`text-xs font-extrabold ${sty.text}`}>
                  {signal.label}
                </div>
                <div className={`text-[10px] ${sty.text} opacity-70 mt-0.5`}>
                  {sp.headDesc}
                </div>
              </div>
            </div>
            <div className={`text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm ${sty.badge}`}>
              {signal.action}
            </div>
          </div>
        )
      })()}

      {/* 智慧減碼試算橫幅（橘/紅燈 + 有持股才顯示）*/}
      {signal && (signal.color === 'orange' || signal.color === 'red') && price && stats.currentShares > 0 && (
        <div className="mx-4 mb-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <div className="text-[10px] font-extrabold text-orange-600 tracking-wider mb-2">
            💡 建議操作參考
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { l: '建議賣出', v: `${Math.floor(stats.currentShares * (signal.color === 'red' ? 1.0 : 0.3))} 股` },
              { l: '保留股數', v: `${stats.currentShares - Math.floor(stats.currentShares * (signal.color === 'red' ? 1.0 : 0.3))} 股` },
              { l: '預估回收', v: `$${fmt(Math.floor(stats.currentShares * (signal.color === 'red' ? 1.0 : 0.3)) * price)}` },
            ].map(({ l, v }) => (
              <div key={l} className="bg-white rounded-xl p-2 border border-orange-100">
                <div className="text-[9px] text-stone-400 mb-0.5">{l}</div>
                <div className="text-sm font-extrabold text-orange-700">{v}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-orange-500 mt-2 text-center">
            詳細試算請點「{signal.color === 'red' ? '資訊' : '賣多少'}」頁籤
          </div>
        </div>
      )}

      {/* Tab 列 */}
      <div className="flex border-b border-stone-100 mx-4 mb-0">
        {TABS.filter(t => !t.hide).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex-shrink-0 ${
              tab === key ? 'border-amber-400 text-amber-600' : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Tab 內容 */}
      <div className="px-4 py-4">
        {tab === 'info' && (
          hasPrice
            ? <HoldingInfoTab stats={stats} price={px} techMode={techMode} />
            : <div className="text-xs text-center text-stone-400 py-4">現價載入中，請稍候…</div>
        )}

        {tab === 'unstuck' && (
          hasPrice
            ? <UnstuckProgress stats={stats} defaultView="ring" />
            : <div className="text-xs text-center text-stone-400 py-4">需要現價才能計算</div>
        )}

        {tab === 'trim' && hasPrice && (
          <TrimCalculator stats={stats} currentPrice={px} />
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
  onSelect: (code: string, name: string, price?: number, signal?: { color: SignalColor; label: string; action: string }) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [sugg, setSugg] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = async (v: string) => {
    setQ(v)
    if (!v.trim()) { setSugg([]); return }
    setSugg((await searchStocks(v).catch(() => [])).slice(0, 6))
  }

  const pick = async (s: SearchResult) => {
    setLoading(true)
    try {
      const r = await analyzeStock(s.code)
      onSelect(s.code, s.name, r.basic.current_price, {
        color:  r.decision_card.signal.color,
        label:  r.decision_card.signal.label,
        action: r.decision_card.main_action,
      })
    } catch { onSelect(s.code, s.name) }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-extrabold text-stone-700">新增持股</span>
        <button onClick={onCancel} className="text-stone-400 text-2xl leading-none hover:text-stone-600">×</button>
      </div>
      <input value={q} onChange={e => doSearch(e.target.value)}
        placeholder="輸入代號或名稱，例如 6770、台積電"
        autoFocus
        className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 mb-1"
      />
      {loading && <div className="text-xs text-center text-stone-400 py-2">取得現價中…</div>}
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
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function PortfolioPage() {
  const { trades, addTrade } = useTradeStore()
  const { techMode } = useUIStore()
  const [priceMap, setPriceMap]     = useState<Record<string, number>>({})
  const [signalMap, setSignalMap]   = useState<Record<string, { color: SignalColor; label: string; action: string }>>({})
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [addingTrade, setAdding]  = useState<{
    code: string; name: string; price?: number; suggested: TradeType
  } | null>(null)

  const stockList = useMemo(() => {
    const seen = new Set<string>()
    return trades.reduce<{ code: string; name: string }[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({ code: t.code, name: t.name }) }
      return acc
    }, [])
  }, [trades])

  const statsMap = useMemo(() => {
    const m: Record<string, HoldingStats> = {}
    for (const { code, name } of stockList) {
      m[code] = calcHoldingStats(code, name, trades, priceMap[code] ?? 0)
    }
    return m
  }, [stockList, trades, priceMap])

  const totalValue      = Object.values(statsMap).reduce((s, x) => s + x.currentValue, 0)
  const totalUnrealized = Object.values(statsMap).reduce((s, x) => s + x.unrealizedPnL, 0)
  const totalRealized   = Object.values(statsMap).reduce((s, x) => s + x.realizedPnL, 0)

  const handleSelectStock = useCallback((code: string, name: string, price?: number, signal?: { color: SignalColor; label: string; action: string }) => {
    setSearching(false)
    if (price)  setPriceMap(m  => ({ ...m,  [code]: price  }))
    if (signal) setSignalMap(m => ({ ...m,  [code]: signal }))
    setAdding({ code, name, price, suggested: suggestTradeType(code, trades, 'buy') })
  }, [trades])

  // 自動載入現有股票的現價與燈號
  const refreshSignal = useCallback(async (code: string) => {
    if (loadingSet.has(code) || priceMap[code]) return
    setLoadingSet(s => new Set(s).add(code))
    try {
      const r = await analyzeStock(code)
      setPriceMap(m  => ({ ...m, [code]: r.basic.current_price }))
      setSignalMap(m => ({ ...m, [code]: {
        color:  r.decision_card.signal.color,
        label:  r.decision_card.signal.label,
        action: r.decision_card.main_action,
      }}))
    } catch {/* 失敗靜默處理 */} finally {
      setLoadingSet(s => { const n = new Set(s); n.delete(code); return n })
    }
  }, [loadingSet, priceMap])

  const handleAddFor = useCallback((code: string, name: string) => {
    setAdding({ code, name, price: priceMap[code], suggested: suggestTradeType(code, trades, 'buy') })
  }, [trades, priceMap])

  const handleSave = useCallback((tradeData: any) => {
    if (!addingTrade) return
    addTrade({ ...tradeData, code: addingTrade.code, name: addingTrade.name })
    setAdding(null)
  }, [addingTrade, addTrade])

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 標題 */}
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
            <div className="text-[10px] text-stone-400 font-bold tracking-widest mb-3">投資組合總覽</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: techMode ? '目前市值' : '現在值多少',     v: `$${fmt(totalValue)}`,      c: 'text-white' },
                { l: techMode ? '未實現損益' : '目前損益',      v: `${totalUnrealized >= 0 ? '+' : ''}${fmt(totalUnrealized)}`, c: totalUnrealized >= 0 ? 'text-red-400' : 'text-emerald-400' },
                { l: techMode ? '已實現損益' : '賣出有賺',      v: totalRealized !== 0 ? `${totalRealized >= 0 ? '+' : ''}${fmt(totalRealized)}` : '—', c: totalRealized >= 0 ? 'text-red-400' : 'text-emerald-400' },
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
              price={priceMap[code] ?? null}
              signal={signalMap[code]}
              onRefresh={() => refreshSignal(code)}
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
