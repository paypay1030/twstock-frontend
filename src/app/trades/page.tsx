'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTradeStore, useDividendStore } from '@/stores'
import { useUIStore } from '@/stores/ui'
import type { TradeRecord, TradeType, InstrumentType } from '@/types'
import { TRADE_META, CONFIDENCE_META } from '@/types'
import { calcTradeStatistics } from '@/lib/trade-stats'
import { calcTotalDividendIncome } from '@/lib/dividend-stats'
import { calcTotalReturn } from '@/lib/fee-calculator'

// ── 工具 ─────────────────────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmtSign = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`
const pnlCls = (n: number) => n > 0 ? 'text-nb-up' : n < 0 ? 'text-nb-down' : 'text-nb-t2'

// ── 統計總覽卡 ───────────────────────────────────────────────
function TradeStatsOverview() {
  const { trades } = useTradeStore()
  const { dividends } = useDividendStore()
  const { techMode } = useUIStore()

  // 由交易紀錄自行推導各股票的 instrumentType（缺省 stock）
  const instrumentTypeMap = useMemo(() => {
    const m: Record<string, InstrumentType> = {}
    for (const t of trades) {
      if (t.instrumentType) m[t.code] = t.instrumentType
    }
    return m
  }, [trades])

  const stats = useMemo(
    () => calcTradeStatistics(trades, instrumentTypeMap),
    [trades, instrumentTypeMap]
  )

  const dividendIncome = useMemo(() => calcTotalDividendIncome(dividends), [dividends])

  // 未實現損益：彙總所有目前持股的帳面損益（沿用既有 HoldingStats 邏輯，
  // 但此頁不主動抓現價以避免與持股管理頁重複發送大量 API 請求；
  // 顯示已實現/股息為主，未實現引導至持股管理頁查看即時數字）
  const totalReturn = calcTotalReturn(stats.totalRealizedPnL, 0, dividendIncome)

  // 交易類型次數
  const typeCounts = useMemo(() => ({
    buy:    trades.filter(t => t.type === 'buy').length,
    add:    trades.filter(t => t.type === 'add').length,
    reduce: trades.filter(t => t.type === 'reduce').length,
    sell:   trades.filter(t => t.type === 'sell').length,
  }), [trades])

  return (
    <div className="space-y-3">
      {/* 交易次數統計 */}
      <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb p-4">
        <div className="text-xs font-extrabold text-nb-t1 mb-3">
          {techMode ? '交易次數統計' : '我做了幾次交易？'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'buy',    label: techMode ? '買進' : '建倉', count: typeCounts.buy,    color: 'text-nb-up bg-red-50' },
            { key: 'add',    label: techMode ? '加碼' : '加買', count: typeCounts.add,    color: 'text-nb-orange bg-nb-s2' },
            { key: 'reduce', label: techMode ? '減碼' : '減少', count: typeCounts.reduce, color: 'text-nb-green bg-nb-s2' },
            { key: 'sell',   label: techMode ? '賣出' : '清倉', count: typeCounts.sell,   color: 'text-nb-down bg-emerald-50' },
          ].map(({ key, label, count, color }) => (
            <div key={key} className={`rounded-xl p-2.5 text-center ${color}`}>
              <div className="text-lg font-extrabold leading-tight">{count}</div>
              <div className="text-[10px] font-semibold mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 真正總報酬 */}
      <div className="bg-gradient-to-br from-nb-t0 to-[#1A1510] rounded-2xl p-4 shadow-nb-md">
        <div className="text-[10px] text-nb-t2 font-bold tracking-widest mb-3">
          {techMode ? '真正總報酬' : '我真正賺了多少？'}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-[9px] text-nb-t2 mb-1 font-medium">
              {techMode ? '已實現損益' : '已落袋'}
            </div>
            <div className={`text-sm font-extrabold leading-tight ${
              stats.totalRealizedPnL >= 0 ? 'text-nb-up' : 'text-nb-down'
            }`}>
              {fmtSign(stats.totalRealizedPnL)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-nb-t2 mb-1 font-medium">
              {techMode ? '股息收入' : '領到股息'}
            </div>
            <div className="text-sm font-extrabold text-nb-down leading-tight">
              +{fmt(dividendIncome)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-nb-t2 mb-1 font-medium">未實現損益</div>
            <div className="text-sm font-extrabold text-nb-t2 leading-tight">
              <Link href="/portfolio" className="underline decoration-dotted">查看 →</Link>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-nb-border2/30 flex justify-between items-center">
          <span className="text-xs text-nb-t2">
            {techMode ? '已實現 + 股息（未含未實現）' : '已落袋 + 股息（未含目前持股損益）'}
          </span>
          <span className={`text-lg font-extrabold ${
            totalReturn.totalReturn >= 0 ? 'text-nb-up' : 'text-nb-down'
          }`}>
            {fmtSign(totalReturn.totalReturn)}
          </span>
        </div>
      </div>

      {/* 交易表現 */}
      {stats.winCount + stats.lossCount > 0 ? (
        <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb p-4">
          <div className="text-xs font-extrabold text-nb-t1 mb-3">
            {techMode ? '交易表現' : '我的勝率如何？'}
          </div>

          {/* 勝率視覺化 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-nb-t2 mb-1">
                <span>勝率 {stats.winRate}%</span>
                <span>{stats.winCount} 勝 / {stats.lossCount} 敗</span>
              </div>
              <div className="h-2.5 bg-nb-border rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-nb-green"
                  style={{ width: `${stats.winRate}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-nb-s2 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-nb-up mb-0.5">
                {techMode ? '平均獲利' : '賺的時候平均賺多少'}
              </div>
              <div className="text-sm font-extrabold text-nb-up">+{fmt(stats.avgGain)}</div>
            </div>
            <div className="bg-nb-s3 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-nb-down mb-0.5">
                {techMode ? '平均虧損' : '賠的時候平均賠多少'}
              </div>
              <div className="text-sm font-extrabold text-nb-down">{fmt(stats.avgLoss)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {stats.maxGain && (
              <div className="bg-nb-s4 rounded-xl p-2.5">
                <div className="text-[10px] text-nb-t2 mb-0.5">
                  {techMode ? '最大獲利' : '最賺的一筆'}
                </div>
                <div className="text-sm font-extrabold text-nb-up">+{fmt(stats.maxGain.amount)}</div>
                <div className="text-[10px] text-nb-t2 mt-0.5">{stats.maxGain.name}</div>
              </div>
            )}
            {stats.maxLoss && (
              <div className="bg-nb-s4 rounded-xl p-2.5">
                <div className="text-[10px] text-nb-t2 mb-0.5">
                  {techMode ? '最大虧損' : '最賠的一筆'}
                </div>
                <div className="text-sm font-extrabold text-nb-down">{fmt(stats.maxLoss.amount)}</div>
                <div className="text-[10px] text-nb-t2 mt-0.5">{stats.maxLoss.name}</div>
              </div>
            )}
          </div>

          {stats.avgHoldingDays !== null && (
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[10px] text-nb-t2">
                {techMode ? '平均持有天數' : '平均放多久才賣'}
              </span>
              <span className="text-xs font-bold text-nb-t1">{stats.avgHoldingDays} 天</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb p-4 text-center">
          <p className="text-xs text-nb-t2">
            {techMode ? '尚無已實現交易，賣出後將顯示勝率統計' : '還沒賣出過股票，賣出後這裡會顯示你的勝率'}
          </p>
        </div>
      )}

      {/* 年度統計 */}
      {stats.byYear.length > 0 && (
        <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb overflow-hidden">
          <div className="px-4 py-3 bg-nb-s4 border-b border-nb-border">
            <span className="text-xs font-extrabold text-nb-t1">
              {techMode ? '年度已實現損益' : '每年賺賠多少'}
            </span>
          </div>
          <div className="divide-y divide-nb-border">
            {stats.byYear.map(y => (
              <div key={y.year} className="flex justify-between items-center px-4 py-3">
                <div>
                  <span className="text-sm font-bold text-nb-t0">{y.year} 年</span>
                  <span className="text-[10px] text-nb-t2 ml-2">{y.tradeCount} 筆</span>
                </div>
                <span className={`text-sm font-extrabold ${pnlCls(y.realizedPnL)}`}>
                  {fmtSign(y.realizedPnL)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center text-[11px] font-extrabold text-white shadow-nb flex-shrink-0 ${meta.badgeBg}`}>
          {meta.short}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-nb-border mt-1.5 mb-0 min-h-[16px]" />}
      </div>

      {/* 卡片 */}
      <div className={`flex-1 mb-3 rounded-2xl border overflow-hidden shadow-nb ${meta.borderColor}`}>
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
              <span className="text-lg font-extrabold text-nb-t0">{trade.price}</span>
              <span className="text-sm text-nb-t2">× {fmt(trade.shares)} 股</span>
              <span className="text-xs text-nb-t2 bg-nb-s0/70 px-2 py-0.5 rounded-full border border-nb-border">
                ${fmt(amount)}
              </span>
            </div>
            {/* 備註 */}
            {trade.note && (
              <div className="text-[11px] text-nb-t2 mt-1 leading-snug">{trade.note}</div>
            )}
          </div>

          {/* 右側：日期 + 信心 + 展開 */}
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-nb-t2">{trade.date}</div>
              {trade.journal?.confidence && (
                <div className="text-sm mt-0.5 text-right">
                  {CONFIDENCE_META[trade.journal.confidence].icon}
                </div>
              )}
            </div>
            {hasJournal && (
              <span className={`text-nb-t3 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDelete(trade.id) }}
              className="w-6 h-6 rounded-full bg-nb-s4 hover:bg-red-100 text-nb-t2 hover:text-nb-up text-sm flex items-center justify-center transition-colors leading-none"
              title="刪除此紀錄"
            >×</button>
          </div>
        </div>

        {/* 投資日誌 */}
        {open && trade.journal && (
          <div className="px-3.5 py-3 bg-nb-orange-bg border-t border-nb-orange/20">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-extrabold text-nb-orange tracking-wider">
                {techMode ? '投資日誌' : '當時的想法'}
              </span>
              <span className="text-xs">
                {CONFIDENCE_META[trade.journal.confidence].icon}
              </span>
              <span className="text-[10px] text-nb-orange">
                {CONFIDENCE_META[trade.journal.confidence].label}
              </span>
            </div>
            <p className="text-sm text-nb-t1 leading-relaxed">{trade.journal.reason}</p>
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
    <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb overflow-hidden mb-4">
      {/* 股票標頭 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-nb-s4 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-nb-s2 to-nb-s3 flex items-center justify-center shadow-inner flex-shrink-0">
            <span className="text-sm font-extrabold text-amber-700">{name.slice(0, 2)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-nb-t0">{name}</span>
              <span className="text-xs text-nb-t2 bg-nb-s4 px-2 py-0.5 rounded-full">{code}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {buys  > 0 && <span className="text-[10px] text-nb-up font-semibold">{techMode ? '買進' : '買'} {buys} 次</span>}
              {sells > 0 && <span className="text-[10px] text-nb-down font-semibold">{techMode ? '賣出' : '賣'} {sells} 次</span>}
              <span className="text-[10px] text-nb-t2">共 {trades.length} 筆</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/analyze?q=${code}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-nb-orange font-semibold px-2.5 py-1 bg-nb-orange-bg rounded-xl hover:bg-nb-orange-bg transition-colors"
          >
            分析 →
          </Link>
          <span className={`text-nb-t3 text-sm transition-transform ${collapsed ? '-rotate-90' : ''}`}>▼</span>
        </div>
      </button>

      {/* 時間軸 */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1 border-t border-nb-border">
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

  const FILTERS: { key: 'all' | TradeType; label: string }[] = [
    { key: 'all',    label: '全部' },
    { key: 'buy',    label: techMode ? '買進' : '建倉' },
    { key: 'add',    label: techMode ? '加碼' : '加買' },
    { key: 'reduce', label: techMode ? '減碼' : '減少' },
    { key: 'sell',   label: techMode ? '賣出' : '出清' },
  ]

  if (totalTrades === 0) {
    return (
      <div className="min-h-screen bg-nb-bg">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-xl font-extrabold text-nb-t0 mb-5">
            {techMode ? '所有交易紀錄' : '我的交易紀錄'}
          </h1>
          <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb p-8 text-center">
            <div className="w-16 h-16 bg-nb-s4 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">📒</div>
            <div className="text-base font-bold text-nb-t1 mb-2">還沒有交易紀錄</div>
            <p className="text-xs text-nb-t2 mb-5 leading-relaxed">
              {techMode
                ? '前往持股管理頁新增交易紀錄，系統會自動計算損益。'
                : '把你每次的買賣記下來，之後就能看到損益、回顧當時的判斷。'}
            </p>
            <Link href="/portfolio"
              className="inline-block px-6 py-2.5 bg-nb-orange text-white text-sm font-bold rounded-xl shadow-nb hover:hover:bg-nb-orange/90 transition-colors"
            >
              前往新增 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nb-bg">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-4">

        {/* 標題 + 簡要摘要 */}
        <div>
          <h1 className="text-xl font-extrabold text-nb-t0 mb-3">
            {techMode ? '所有交易紀錄' : '我的交易紀錄'}
          </h1>

          <div className="bg-nb-s0 rounded-2xl border border-nb-border shadow-nb px-4 py-3 flex items-center gap-4">
            <div>
              <span className="text-2xl font-extrabold text-nb-t0">{totalTrades}</span>
              <span className="text-xs text-nb-t2 ml-1">筆</span>
            </div>
            <div className="w-px h-8 bg-nb-s4" />
            <div>
              <span className="text-2xl font-extrabold text-nb-t0">{stockCount}</span>
              <span className="text-xs text-nb-t2 ml-1">檔股票</span>
            </div>
          </div>
        </div>

        {/* 完整統計總覽：交易次數 / 真正總報酬 / 勝率 / 年度統計 */}
        <TradeStatsOverview />

        {/* 篩選器 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === key
                  ? 'bg-nb-orange text-white shadow-nb'
                  : 'bg-nb-s0 text-nb-t2 border border-nb-border2 hover:border-nb-border2'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* 時間軸列表 */}
        {Object.entries(filteredByCode).length === 0 ? (
          <div className="text-center py-10 text-nb-t2 text-sm">
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

        <p className="text-center text-[10px] text-nb-t3 pb-2">
          所有交易紀錄存於本機，不會上傳至任何伺服器
        </p>
      </div>
    </div>
  )
}
