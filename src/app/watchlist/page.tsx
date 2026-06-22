'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useWatchlistStore } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { searchStocks, getStockBasic } from '@/lib/api'
import type { SearchResult, InstrumentType } from '@/types'

const fmt = (n: number) => n.toLocaleString('zh-TW')

type SortKey = 'addedDate' | 'changePct' | 'name'
type LoadStatus = 'loading' | 'done' | 'error'

interface PriceInfo {
  price: number
  change: number
  changePct: number
}

// ── 新增自選股搜尋面板 ───────────────────────────────────────
function AddWatchPanel({ onCancel }: { onCancel: () => void }) {
  const { addWatch, watchlist } = useWatchlistStore()
  const { techMode } = useUIStore()
  const [q, setQ] = useState('')
  const [sugg, setSugg] = useState<SearchResult[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  const doSearch = async (v: string) => {
    setQ(v)
    if (!v.trim()) { setSugg([]); return }
    setSugg((await searchStocks(v).catch(() => [])).slice(0, 8))
  }

  const handleAdd = async (s: SearchResult) => {
    setAdding(s.code)
    const instrumentType: InstrumentType = s.type === 'ETF' ? 'etf' : 'stock'
    addWatch({
      code: s.code,
      name: s.name,
      addedDate: new Date().toISOString().split('T')[0],
      instrumentType,
    })
    setAdding(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-extrabold text-stone-700">
          {techMode ? '新增自選股' : '加入想追蹤的股票'}
        </span>
        <button onClick={onCancel} className="text-stone-400 text-2xl leading-none hover:text-stone-600">×</button>
      </div>
      <input
        value={q}
        onChange={e => doSearch(e.target.value)}
        placeholder="輸入代號或名稱，例如 0050、台積電"
        autoFocus
        className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 mb-1"
      />
      <div className="space-y-0.5">
        {sugg.map(s => {
          const already = watchlist.some(w => w.code === s.code)
          return (
            <button
              key={s.code}
              onClick={() => !already && handleAdd(s)}
              disabled={already || adding === s.code}
              className="w-full flex justify-between items-center px-3.5 py-2.5 hover:bg-stone-50 rounded-xl text-sm disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-700">{s.code}</span>
                <span className="text-stone-500">{s.name}</span>
                {s.type === 'ETF' && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full font-bold">ETF</span>
                )}
              </div>
              <span className="text-xs font-bold">
                {already ? '✓ 已加入' : adding === s.code ? '加入中…' : '+ 加入'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 單檔自選股卡 ─────────────────────────────────────────────
function WatchItem({
  code, name, addedDate, instrumentType, priceInfo, status, onRemove,
}: {
  code: string; name: string; addedDate: string
  instrumentType?: InstrumentType
  priceInfo: PriceInfo | null
  status: LoadStatus
  onRemove: () => void
}) {
  const { techMode } = useUIStore()
  const isUp = priceInfo ? priceInfo.change >= 0 : null

  return (
    <Link
      href={`/analyze?q=${code}`}
      className="flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-extrabold text-amber-700">{name.slice(0, 2)}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-stone-800 truncate">{name}</span>
            {instrumentType === 'etf' && (
              <span className="text-[9px] px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full font-bold flex-shrink-0">ETF</span>
            )}
          </div>
          <div className="text-[10px] text-stone-400">
            {code} · {techMode ? `加入於 ${addedDate}` : `${addedDate} 加入`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {status === 'loading' && (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        )}
        {status === 'error' && (
          <span className="text-[10px] text-red-400">取得失敗</span>
        )}
        {status === 'done' && priceInfo && (
          <div className="text-right">
            <div className="text-sm font-extrabold text-stone-800">{priceInfo.price}</div>
            <div className={`text-[11px] font-semibold ${isUp ? 'text-red-500' : 'text-emerald-600'}`}>
              {isUp ? '+' : ''}{priceInfo.changePct.toFixed(2)}%
            </div>
          </div>
        )}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove() }}
          className="w-7 h-7 rounded-full bg-stone-100 hover:bg-red-100 text-stone-400 hover:text-red-400 text-sm flex items-center justify-center transition-colors"
        >×</button>
      </div>
    </Link>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function WatchlistPage() {
  const { watchlist, removeWatch } = useWatchlistStore()
  const { techMode } = useUIStore()
  const [adding, setAdding] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('addedDate')

  const [priceMap, setPriceMap] = useState<Record<string, PriceInfo>>({})
  const [statusMap, setStatusMap] = useState<Record<string, LoadStatus>>({})

  // 頁面載入後自動取得所有自選股現價（沿用持股管理頁驗證過的穩定模式）
  useEffect(() => {
    for (const w of watchlist) {
      if (statusMap[w.code] === 'done' || statusMap[w.code] === 'loading') continue
      setStatusMap(m => ({ ...m, [w.code]: 'loading' }))
      getStockBasic(w.code)
        .then(data => {
          if (!data.current_price || data.current_price <= 0) throw new Error('現價無效')
          setPriceMap(m => ({ ...m, [w.code]: {
            price: data.current_price,
            change: data.change,
            changePct: data.change_pct,
          }}))
          setStatusMap(m => ({ ...m, [w.code]: 'done' }))
        })
        .catch(() => {
          setStatusMap(m => ({ ...m, [w.code]: 'error' }))
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist])

  const sorted = useMemo(() => {
    const list = [...watchlist]
    switch (sortKey) {
      case 'changePct':
        return list.sort((a, b) => {
          const pa = priceMap[a.code]?.changePct ?? -999
          const pb = priceMap[b.code]?.changePct ?? -999
          return pb - pa   // 漲幅高到低
        })
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
      case 'addedDate':
      default:
        return list.sort((a, b) => b.addedDate.localeCompare(a.addedDate))   // 最新加入優先
    }
  }, [watchlist, sortKey, priceMap])

  const SORT_OPTIONS: { key: SortKey; label: string; plainLabel: string }[] = [
    { key: 'addedDate', label: '加入時間', plainLabel: '最新加入' },
    { key: 'changePct', label: '漲跌幅',   plainLabel: '漲跌排序' },
    { key: 'name',      label: '名稱',     plainLabel: '名稱排序' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 標題 */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-extrabold text-stone-900">
            {techMode ? '自選股' : '我關注的股票'}
          </h1>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-extrabold rounded-xl shadow-sm transition-colors"
          >
            <span className="text-base leading-none">+</span> 新增
          </button>
        </div>

        {/* 新增面板 */}
        {adding && <AddWatchPanel onCancel={() => setAdding(false)} />}

        {/* 排序切換 */}
        {watchlist.length > 1 && (
          <div className="flex gap-1.5">
            <span className="text-xs text-stone-400 self-center mr-1">
              {techMode ? '排序：' : '排序方式：'}
            </span>
            {SORT_OPTIONS.map(({ key, label, plainLabel }) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  sortKey === key
                    ? 'bg-amber-400 text-white border-amber-400'
                    : 'bg-white text-stone-500 border-stone-200'
                }`}
              >
                {techMode ? label : plainLabel}
              </button>
            ))}
          </div>
        )}

        {/* 列表 */}
        {sorted.length > 0 ? (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm divide-y divide-stone-50 overflow-hidden">
            {sorted.map(w => (
              <WatchItem
                key={w.id}
                code={w.code}
                name={w.name}
                addedDate={w.addedDate}
                instrumentType={w.instrumentType}
                priceInfo={priceMap[w.code] ?? null}
                status={statusMap[w.code] ?? 'loading'}
                onRemove={() => removeWatch(w.id)}
              />
            ))}
          </div>
        ) : (
          !adding && (
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                ⭐
              </div>
              <div className="text-base font-extrabold text-stone-600 mb-2">
                {techMode ? '尚無自選股' : '還沒有關注的股票'}
              </div>
              <div className="text-xs text-stone-400 leading-relaxed mb-4">
                {techMode
                  ? '加入股票或 ETF，不需持有也能追蹤'
                  : '不用真的買，先加進來觀察也可以'}
              </div>
              <button
                onClick={() => setAdding(true)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                新增第一檔
              </button>
            </div>
          )
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
