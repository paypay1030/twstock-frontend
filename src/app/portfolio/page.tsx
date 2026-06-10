'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTradeStore, calcHoldingStats, suggestTradeType } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { analyzeStock, searchStocks } from '@/lib/api'
import { generateUnstuckText } from '@/lib/plain-talk'
import type { SearchResult, HoldingStats, TradeType } from '@/types'
import { TRADE_META } from '@/types'
import TradeForm from '@/components/cards/TradeForm'
import TradeTimeline from '@/components/cards/TradeTimeline'
import UnstuckProgress from '@/components/ui/UnstuckProgress'
import TrimCalculator from '@/components/ui/TrimCalculator'

// ── 工具 ─────────────────────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const pnlCls = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-emerald-600' : 'text-stone-500'

// ── 持股資訊卡（白話版）──────────────────────────────────────
function HoldingInfoPanel({ stats, price, techMode }: {
  stats: HoldingStats; price: number; techMode: boolean
}) {
  const unstuck = generateUnstuckText(
    stats.avgCost, price, stats.currentShares, stats.distanceToBreakeven
  )

  return (
    <div className="space-y-3">
      {/* 文字摘要（白話模式）*/}
      {!techMode && (
        <div className="px-3 py-2.5 bg-stone-50 rounded-xl text-sm text-stone-600 leading-relaxed border border-stone-100">
          {unstuck.summary}
        </div>
      )}

      {/* 六欄數據 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {[
          { l: techMode ? '加權平均成本' : '我的買進成本',   v: `${stats.avgCost} 元` },
          { l: techMode ? '最近買進價'   : '最近一次買進',   v: stats.latestBuyPrice != null ? `${stats.latestBuyPrice} 元` : '—' },
          { l: techMode ? '持股股數'     : '我持有多少股',   v: `${fmt(stats.currentShares)} 股（${Math.floor(stats.currentShares/1000)} 張）` },
          { l: techMode ? '最近賣出價'   : '最近一次賣出',   v: stats.latestSellPrice != null ? `${stats.latestSellPrice} 元` : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div className="text-[10px] text-stone-400 mb-0.5">{l}</div>
            <div className="text-sm font-bold text-stone-800">{v}</div>
          </div>
        ))}
      </div>

      {/* 損益三欄 */}
      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-stone-100">
        <div className="text-center">
          <div className="text-[10px] text-stone-400 mb-0.5">
            {techMode ? '未實現損益' : (stats.unrealizedPnL >= 0 ? '目前獲利' : '目前虧損')}
          </div>
          <div className={`text-sm font-bold ${pnlCls(stats.unrealizedPnL)}`}>
            {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}
          </div>
          <div className={`text-[10px] ${pnlCls(stats.unrealizedPnLPct)}`}>
            {fmtPct(stats.unrealizedPnLPct)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stone-400 mb-0.5">{techMode ? '目前市值' : '現在值多少'}</div>
          <div className="text-sm font-bold text-stone-700">${fmt(stats.currentValue)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stone-400 mb-0.5">
            {techMode ? '已實現損益' : '賣出後有賺'}
          </div>
          <div className={`text-sm font-bold ${pnlCls(stats.realizedPnL)}`}>
            {stats.realizedPnL !== 0
              ? `${stats.realizedPnL >= 0 ? '+' : ''}${fmt(stats.realizedPnL)}`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 搜尋股票 ─────────────────────────────────────────────────
function StockSearchPanel({ onSelect, onCancel }: {
  onSelect: (code: string, name: string, price?: number) => void
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
      onSelect(s.code, s.name, r.basic.current_price)
    } catch {
      onSelect(s.code, s.name)
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold text-stone-700">新增持股</span>
        <button onClick={onCancel} className="text-stone-400 text-xl leading-none">×</button>
      </div>
      <input value={q} onChange={e => doSearch(e.target.value)}
        placeholder="輸入代號或名稱，例如 6770、台積電"
        autoFocus
        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 mb-2"
      />
      {loading && <div className="text-xs text-center text-stone-400 py-1">取得現價中…</div>}
      {sugg.map(s => (
        <button key={s.code} onClick={() => pick(s)}
          className="w-full flex justify-between items-center px-3 py-2.5 hover:bg-stone-50 rounded-xl text-sm"
        >
          <span className="font-bold text-stone-700">{s.code}</span>
          <span className="text-stone-500">{s.name}</span>
          <span className="text-[11px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{s.market}</span>
        </button>
      ))}
    </div>
  )
}

// ── 單檔持股卡（完整版）─────────────────────────────────────
type CardTab = 'info' | 'unstuck' | 'trim' | 'timeline'

function HoldingCard({ stats, price, onAddTrade }: {
  stats: HoldingStats; price: number | null; onAddTrade: () => void
}) {
  const [tab, setTab] = useState<CardTab>('info')
  const { trades, deleteTrade } = useTradeStore()
  const { techMode } = useUIStore()
  const codeTrades = trades.filter(t => t.code === stats.code)
  const px = price ?? 0
  const hasPrice = px > 0

  const TABS: { key: CardTab; label: string; hide?: boolean }[] = [
    { key: 'info',     label: techMode ? '持股資訊' : '持股資訊' },
    { key: 'unstuck',  label: techMode ? '解套進度' : '距離回本', hide: stats.isProfit && stats.currentShares > 0 },
    { key: 'trim',     label: techMode ? '減碼試算' : '賣多少合適', hide: stats.currentShares === 0 },
    { key: 'timeline', label: `紀錄（${codeTrades.length}）` },
  ]

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* 股票標頭 */}
      <div className="px-4 py-3 border-b border-stone-100">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-stone-800">{stats.name}</span>
              <span className="text-xs text-stone-400">{stats.code}</span>
              {stats.currentShares > 0 && (
                <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                  {fmt(stats.currentShares)} 股
                </span>
              )}
            </div>
            {hasPrice && stats.currentShares > 0 && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-stone-400">現價 {px}</span>
                <span className={`text-xs font-bold ${pnlCls(stats.unrealizedPnL)}`}>
                  {stats.unrealizedPnL >= 0 ? '+' : ''}{fmt(stats.unrealizedPnL)}
                  （{fmtPct(stats.unrealizedPnLPct)}）
                </span>
              </div>
            )}
          </div>
          <button onClick={onAddTrade}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-colors"
          >+ 新增</button>
        </div>
      </div>

      {/* Tab 列 */}
      <div className="flex border-b border-stone-100 overflow-x-auto">
        {TABS.filter(t => !t.hide).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-shrink-0 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              tab === key
                ? 'border-amber-400 text-amber-600'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Tab 內容 */}
      <div className="p-4">
        {tab === 'info' && (
          hasPrice
            ? <HoldingInfoPanel stats={stats} price={px} techMode={techMode} />
            : <div className="text-xs text-center text-stone-400 py-4">現價載入中…</div>
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
          <TradeTimeline
            trades={codeTrades}
            onDelete={deleteTrade}
            maxVisible={5}
          />
        )}
      </div>
    </div>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function PortfolioPage() {
  const { trades, addTrade } = useTradeStore()
  const { techMode } = useUIStore()
  const [priceMap, setPriceMap]   = useState<Record<string, number>>({})
  const [searching, setSearching] = useState(false)
  const [addingTrade, setAdding]  = useState<{
    code: string; name: string; price?: number; suggested: TradeType
  } | null>(null)

  // 從交易紀錄推導持股清單
  const stockList = useMemo(() => {
    const seen = new Set<string>()
    return trades.reduce<{code:string;name:string}[]>((acc, t) => {
      if (!seen.has(t.code)) { seen.add(t.code); acc.push({code:t.code, name:t.name}) }
      return acc
    }, [])
  }, [trades])

  // 統計
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

  const handleSelectStock = useCallback((code: string, name: string, price?: number) => {
    setSearching(false)
    if (price) setPriceMap(m => ({ ...m, [code]: price }))
    setAdding({ code, name, price, suggested: suggestTradeType(code, trades, 'buy') })
  }, [trades])

  const handleAddTradeFor = useCallback((code: string, name: string) => {
    setAdding({
      code, name,
      price: priceMap[code],
      suggested: suggestTradeType(code, trades, 'buy'),
    })
  }, [trades, priceMap])

  const handleSaveTrade = useCallback((tradeData: any) => {
    if (!addingTrade) return
    addTrade({ ...tradeData, code: addingTrade.code, name: addingTrade.name })
    setAdding(null)
  }, [addingTrade, addTrade])

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-5">

        {/* 標題 */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-stone-800">
            {techMode ? '持股管理' : '我的持股'}
          </h1>
          <button onClick={() => setSearching(true)}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold rounded-xl"
          >+ 新增持股</button>
        </div>

        {/* 總覽 */}
        {stockList.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: techMode ? '目前市值' : '現在值多少',     v: `$${fmt(totalValue)}`,      c: 'text-stone-800' },
              { l: techMode ? '未實現損益' : '目前獲利/虧損', v: `${totalUnrealized >= 0 ? '+' : ''}${fmt(totalUnrealized)}`, c: pnlCls(totalUnrealized) },
              { l: techMode ? '已實現損益' : '賣出後有賺',    v: totalRealized !== 0 ? `${totalRealized >= 0 ? '+' : ''}${fmt(totalRealized)}` : '—', c: pnlCls(totalRealized) },
            ].map(({ l, v, c }) => (
              <div key={l} className="bg-white rounded-xl border border-stone-200 p-3 text-center">
                <div className="text-[10px] text-stone-400 mb-1">{l}</div>
                <div className={`text-sm font-bold ${c}`}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* 搜尋面板 */}
        {searching && (
          <StockSearchPanel onSelect={handleSelectStock} onCancel={() => setSearching(false)} />
        )}

        {/* 新增交易表單 */}
        {addingTrade && (
          <div className="mb-4">
            <TradeForm
              code={addingTrade.code}
              name={addingTrade.name}
              currentPrice={addingTrade.price}
              suggestedType={addingTrade.suggested}
              onSave={handleSaveTrade}
              onCancel={() => setAdding(null)}
            />
          </div>
        )}

        {/* 持股列表 */}
        {stockList.length > 0 ? (
          <div className="space-y-4">
            {stockList.map(({ code, name }) => (
              <HoldingCard
                key={code}
                stats={statsMap[code]}
                price={priceMap[code] ?? null}
                onAddTrade={() => handleAddTradeFor(code, name)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-stone-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm">
              {techMode ? '尚無持股紀錄' : '還沒有持股紀錄'}
            </div>
            <div className="text-xs mt-1">
              {techMode ? '點擊右上角「新增持股」開始記錄' : '點右上角「新增持股」開始記錄你的第一筆交易'}
            </div>
          </div>
        )}
        <div className="h-16" />
      </div>
    </div>
  )
}
