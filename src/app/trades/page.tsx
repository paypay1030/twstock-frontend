'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTradeStore } from '@/stores'
import { useUIStore } from '@/stores/ui'
import type { TradeRecord, TradeType } from '@/types'
import { TRADE_META, CONFIDENCE_META } from '@/types'

// ── 工具 ─────────────────────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

// ── 單筆交易 Timeline Item ───────────────────────────────────
function TimelineItem({
  trade, isLast, onDelete,
}: { trade: TradeRecord; isLast: boolean; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const { techMode } = useUIStore()
  const meta = TRADE_META[trade.type]
  const hasJournal = !!trade.journal?.reason
  const amount = Math.round(trade.price * trade.shares)

  // 白話動作說明
  const PLAIN_ACTION: Record<TradeType, string> = {
    buy:    '開始買進',
    add:    '加買更多',
    reduce: '賣出一部分',
    sell:   '全部賣出',
  }

  return (
    <div className="flex gap-3">
      {/* 時間軸線 */}
      <div className="flex flex-col items-center flex-shrink-0 pt-0.5" style={{ width: 32 }}>
        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center text-[11px] font-extrabold text-white shadow-sm flex-shrink-0 ${meta.badgeBg}`}>
          {meta.short}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-stone-200 mt-1.5 mb-0 min-h-[16px]" />}
      </div>

      {/* 卡片 */}
      <div className={`flex-1 mb-3 rounded-2xl border overflow-hidden shadow-sm ${meta.borderColor}`}>
        {/* 主行 */}
        <div
          className={`px-3.5 py-3 flex justify-between items-start ${meta.rowBg} ${hasJournal ? 'cursor-pointer' : ''}`}
          onClick={() => hasJournal && setOpen(!open)}
        >
          <div className="flex-1 min-w-0">
            {/* 動作標籤 */}
            <div className={`text-[10px] font-extrabold tracking-wider mb-1 ${meta.textColor}`}>
              {techMode ? meta.label : PLAIN_ACTION[trade.type]}
            </div>
            {/* 價格 × 股數 */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-extrabold text-stone-900">{trade.price}</span>
              <span className="text-sm text-stone-500">× {fmt(trade.shares)} 股</span>
              <span className="text-xs text-stone-400 bg-white/70 px-2 py-0.5 rounded-full border border-stone-100">
                ${fmt(amount)}
              </span>
            </div>
            {/* 備註 */}
            {trade.note && (
              <div className="text-[11px] text-stone-400 mt-1 leading-snug">{trade.note}</div>
            )}
          </div>

          {/* 右側：日期 + 信心 + 展開 */}
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-stone-400">{trade.date}</div>
              {trade.journal?.confidence && (
                <div className="text-sm mt-0.5 text-right">
                  {CONFIDENCE_META[trade.journal.confidence].icon}
                </div>
              )}
            </div>
            {hasJournal && (
              <span className={`text-stone-300 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDelete(trade.id) }}
              className="w-6 h-6 rounded-full bg-stone-100 hover:bg-red-100 text-stone-400 hover:text-red-400 text-sm flex items-center justify-center transition-colors leading-none"
              title="刪除此紀錄"
            >×</button>
          </div>
        </div>

        {/* 投資日誌 */}
        {open && trade.journal && (
          <div className="px-3.5 py-3 bg-amber-50 border-t border-amber-100">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-extrabold text-amber-600 tracking-wider">
                {techMode ? '投資日誌' : '當時的想法'}
              </span>
              <span className="text-xs">
                {CONFIDENCE_META[trade.journal.confidence].icon}
              </span>
              <span className="text-[10px] text-amber-500">
                {CONFIDENCE_META[trade.journal.confidence].label}
              </span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">{trade.journal.reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 單檔股票的交易歷史區塊 ────────────────────────────────────
function StockTradeGroup({
  code, name, trades, onDelete,
}: { code: string; name: string; trades: TradeRecord[]; onDelete: (id: string) => void }) {
  const { techMode } = useUIStore()
  const [collapsed, setCollapsed] = useState(false)

  const sorted = useMemo(
    () => [...trades].sort((a, b) => b.date.localeCompare(a.date)),
    [trades]
  )

  // 統計
  const buys   = trades.filter(t => t.type === 'buy'  || t.type === 'add').length
  const sells  = trades.filter(t => t.type === 'sell' || t.type === 'reduce').length
  const total  = trades.reduce((s, t) => {
    if (t.type === 'buy' || t.type === 'add')      return s + t.price * t.shares
    if (t.type === 'sell' || t.type === 'reduce')  return s - t.price * t.shares
    return s
  }, 0)

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden mb-4">
      {/* 股票標頭 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-inner flex-shrink-0">
            <span className="text-sm font-extrabold text-amber-700">{name.slice(0, 2)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-stone-900">{name}</span>
              <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{code}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {buys  > 0 && <span className="text-[10px] text-red-500 font-semibold">{techMode ? '買進' : '買'} {buys} 次</span>}
              {sells > 0 && <span className="text-[10px] text-emerald-600 font-semibold">{techMode ? '賣出' : '賣'} {sells} 次</span>}
              <span className="text-[10px] text-stone-400">共 {trades.length} 筆</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/analyze?q=${code}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-amber-500 font-semibold px-2.5 py-1 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
          >
            分析 →
          </Link>
          <span className={`text-stone-300 text-sm transition-transform ${collapsed ? '-rotate-90' : ''}`}>▼</span>
        </div>
      </button>

      {/* 時間軸 */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1 border-t border-stone-50">
          {sorted.map((t, i) => (
            <TimelineItem
              key={t.id}
              trade={t}
              isLast={i === sorted.length - 1}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function TradesPage() {
  const { trades, deleteTrade } = useTradeStore()
  const { techMode } = useUIStore()
  const [filter, setFilter] = useState<'all' | TradeType>('all')

  // 按股票分組
  const byCode = useMemo(() => {
    const m: Record<string, { name: string; trades: TradeRecord[] }> = {}
    for (const t of trades) {
      if (!m[t.code]) m[t.code] = { name: t.name, trades: [] }
      m[t.code].trades.push(t)
    }
    return m
  }, [trades])

  // 篩選後的交易
  const filteredByCode = useMemo(() => {
    if (filter === 'all') return byCode
    const m: typeof byCode = {}
    for (const [code, { name, trades: ts }] of Object.entries(byCode)) {
      const filtered = ts.filter(t => t.type === filter)
      if (filtered.length > 0) m[code] = { name, trades: filtered }
    }
    return m
  }, [byCode, filter])

  const totalTrades = trades.length
  const stockCount  = Object.keys(byCode).length

  // 全域統計
  const stats = useMemo(() => ({
    buy:    trades.filter(t => t.type === 'buy').length,
    add:    trades.filter(t => t.type === 'add').length,
    reduce: trades.filter(t => t.type === 'reduce').length,
    sell:   trades.filter(t => t.type === 'sell').length,
  }), [trades])

  const FILTERS: { key: 'all' | TradeType; label: string }[] = [
    { key: 'all',    label: '全部' },
    { key: 'buy',    label: techMode ? '買進' : '建倉' },
    { key: 'add',    label: techMode ? '加碼' : '加買' },
    { key: 'reduce', label: techMode ? '減碼' : '減少' },
    { key: 'sell',   label: techMode ? '賣出' : '出清' },
  ]

  if (totalTrades === 0) {
    return (
      <div className="min-h-screen bg-[#F7F5F3]">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-xl font-extrabold text-stone-800 mb-5">
            {techMode ? '所有交易紀錄' : '我的交易紀錄'}
          </h1>
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">📒</div>
            <div className="text-base font-bold text-stone-600 mb-2">還沒有交易紀錄</div>
            <p className="text-xs text-stone-400 mb-5 leading-relaxed">
              {techMode
                ? '前往持股管理頁新增交易紀錄，系統會自動計算損益。'
                : '把你每次的買賣記下來，之後就能看到損益、回顧當時的判斷。'}
            </p>
            <Link href="/portfolio"
              className="inline-block px-6 py-2.5 bg-amber-400 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-amber-500 transition-colors"
            >
              前往新增 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 標題 + 統計 */}
        <div>
          <h1 className="text-xl font-extrabold text-stone-800 mb-3">
            {techMode ? '所有交易紀錄' : '我的交易紀錄'}
          </h1>

          {/* 統計卡 */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-3">
            <div className="flex items-center gap-4 mb-3">
              <div>
                <span className="text-2xl font-extrabold text-stone-900">{totalTrades}</span>
                <span className="text-xs text-stone-400 ml-1">筆</span>
              </div>
              <div className="w-px h-8 bg-stone-100" />
              <div>
                <span className="text-2xl font-extrabold text-stone-900">{stockCount}</span>
                <span className="text-xs text-stone-400 ml-1">檔股票</span>
              </div>
            </div>
            {/* 型別分布 */}
            <div className="flex gap-2 flex-wrap">
              {([
                { type: 'buy',    count: stats.buy,    color: 'bg-red-100 text-red-600' },
                { type: 'add',    count: stats.add,    color: 'bg-orange-100 text-orange-600' },
                { type: 'reduce', count: stats.reduce, color: 'bg-teal-100 text-teal-600' },
                { type: 'sell',   count: stats.sell,   color: 'bg-emerald-100 text-emerald-600' },
              ] as const).filter(x => x.count > 0).map(({ type, count, color }) => (
                <span key={type} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${color}`}>
                  {TRADE_META[type].label} {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 篩選器 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === key
                  ? 'bg-amber-400 text-white shadow-sm'
                  : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-300'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* 時間軸列表 */}
        {Object.entries(filteredByCode).length === 0 ? (
          <div className="text-center py-10 text-stone-400 text-sm">
            此類型尚無紀錄
          </div>
        ) : (
          Object.entries(filteredByCode).map(([code, { name, trades: ts }]) => (
            <StockTradeGroup
              key={code}
              code={code}
              name={name}
              trades={ts}
              onDelete={deleteTrade}
            />
          ))
        )}

        <p className="text-center text-[10px] text-stone-300 pb-2">
          所有交易紀錄存於本機，不會上傳至任何伺服器
        </p>
      </div>
    </div>
  )
}
