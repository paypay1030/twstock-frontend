'use client'

import { useState, useMemo } from 'react'
import { useDividendStore } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { searchStocks } from '@/lib/api'
import { calcDividendOverview } from '@/lib/dividend-stats'
import type { SearchResult } from '@/types'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

// ── 新增股息表單 ─────────────────────────────────────────────
function AddDividendForm({ onCancel }: { onCancel: () => void }) {
  const { addDividend } = useDividendStore()
  const { techMode } = useUIStore()

  const [query, setQuery] = useState('')
  const [sugg, setSugg] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const doSearch = async (v: string) => {
    setQuery(v)
    setSelected(null)
    if (!v.trim()) { setSugg([]); return }
    setSugg((await searchStocks(v).catch(() => [])).slice(0, 6))
  }

  const pick = (s: SearchResult) => {
    setSelected({ code: s.code, name: s.name })
    setQuery(`${s.code} ${s.name}`)
    setSugg([])
  }

  const valid = selected && date && amount && parseFloat(amount) > 0

  const handleSave = () => {
    if (!valid || !selected) return
    addDividend({
      code: selected.code,
      name: selected.name,
      date,
      amount: parseFloat(amount),
      note: note || undefined,
    })
    onCancel()
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
        <span className="text-sm font-extrabold text-stone-700">
          {techMode ? '新增股息紀錄' : '記一筆股息'}
        </span>
        <button onClick={onCancel} className="text-stone-400 text-2xl leading-none hover:text-stone-600">×</button>
      </div>

      <div className="p-4 space-y-3">
        {/* 股票搜尋 */}
        <div>
          <label className="text-xs text-stone-400 mb-1 block">股票</label>
          <input
            value={query}
            onChange={e => doSearch(e.target.value)}
            placeholder="輸入代號或名稱，例如 2330、台積電"
            className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300"
          />
          {sugg.length > 0 && (
            <div className="mt-1 border border-stone-100 rounded-xl overflow-hidden">
              {sugg.map(s => (
                <button
                  key={s.code}
                  onClick={() => pick(s)}
                  className="w-full flex justify-between items-center px-3.5 py-2.5 hover:bg-stone-50 text-sm"
                >
                  <span className="font-bold text-stone-700">{s.code}</span>
                  <span className="text-stone-500">{s.name}</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="mt-1.5 text-xs text-emerald-600 font-medium">
              ✓ 已選擇：{selected.name} {selected.code}
            </div>
          )}
        </div>

        {/* 日期 + 金額 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-stone-400 mb-1 block">發放日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">金額（元）</label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="例如 2200"
              className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300"
            />
          </div>
        </div>

        {/* 備註 */}
        <div>
          <label className="text-xs text-stone-400 mb-1 block">備註（選填）</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例如：現金股利、第一季配息"
            className="w-full h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!valid}
          className="w-full h-12 bg-amber-400 hover:bg-amber-500 disabled:bg-stone-200 disabled:text-stone-400 text-white text-sm font-extrabold rounded-xl shadow-sm transition-colors"
        >
          儲存股息紀錄
        </button>
      </div>
    </div>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function DividendsPage() {
  const { dividends, deleteDividend } = useDividendStore()
  const { techMode } = useUIStore()
  const [adding, setAdding] = useState(false)
  const [expandedStock, setExpandedStock] = useState<string | null>(null)

  const overview = useMemo(() => calcDividendOverview(dividends), [dividends])

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 標題 */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-extrabold text-stone-900">
            {techMode ? '股息中心' : '我領了多少股息？'}
          </h1>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-extrabold rounded-xl shadow-sm transition-colors"
          >
            <span className="text-base leading-none">+</span> 新增
          </button>
        </div>

        {/* 總覽卡（深色，呼應持股管理頁設計語言）*/}
        {dividends.length > 0 && (
          <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-4 shadow-md">
            <div className="text-[10px] text-stone-400 font-bold tracking-widest mb-3">
              {techMode ? '股息收入總覽' : '股息收入'}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[9px] text-stone-500 mb-1 font-medium">累積股息</div>
                <div className="text-base font-extrabold text-emerald-400 leading-tight">
                  ${fmt(overview.totalIncome)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-stone-500 mb-1 font-medium">今年股息</div>
                <div className="text-base font-extrabold text-emerald-400 leading-tight">
                  ${fmt(overview.thisYearIncome)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-stone-500 mb-1 font-medium">紀錄筆數</div>
                <div className="text-base font-extrabold text-white leading-tight">
                  {overview.totalCount} 筆
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 新增表單 */}
        {adding && <AddDividendForm onCancel={() => setAdding(false)} />}

        {/* 各股票累積股息 */}
        {overview.byStock.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
              <span className="text-sm font-extrabold text-stone-700">
                {techMode ? '各股票累積股息' : '每檔股票領了多少'}
              </span>
            </div>
            <div className="divide-y divide-stone-50">
              {overview.byStock.map(s => (
                <div key={s.code}>
                  <button
                    onClick={() => setExpandedStock(expandedStock === s.code ? null : s.code)}
                    className="w-full flex justify-between items-center px-4 py-3 hover:bg-stone-50 transition-colors"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-800">{s.name}</span>
                        <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{s.code}</span>
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {s.count} 筆・最近 {s.latestDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-emerald-600">+${fmt(s.totalAmount)}</span>
                      <span className={`text-stone-300 text-xs transition-transform ${expandedStock === s.code ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </button>

                  {/* 展開：該股票的所有股息明細 */}
                  {expandedStock === s.code && (
                    <div className="px-4 pb-3 bg-stone-50/50">
                      {dividends
                        .filter(d => d.code === s.code)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(d => (
                          <div key={d.id} className="flex justify-between items-center py-2 border-b border-stone-100 last:border-0">
                            <div>
                              <div className="text-xs text-stone-600 font-medium">{d.date}</div>
                              {d.note && <div className="text-[10px] text-stone-400 mt-0.5">{d.note}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-600">+${fmt(d.amount)}</span>
                              <button
                                onClick={() => deleteDividend(d.id)}
                                className="w-5 h-5 rounded-full bg-white hover:bg-red-100 text-stone-300 hover:text-red-400 text-xs flex items-center justify-center transition-colors"
                              >×</button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 年度統計 */}
        {overview.byYear.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
              <span className="text-sm font-extrabold text-stone-700">
                {techMode ? '年度統計' : '每年領了多少'}
              </span>
            </div>
            <div className="divide-y divide-stone-50">
              {overview.byYear.map(y => (
                <div key={y.year} className="flex justify-between items-center px-4 py-3">
                  <div>
                    <span className="text-sm font-bold text-stone-800">{y.year} 年</span>
                    <span className="text-[10px] text-stone-400 ml-2">{y.count} 筆</span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-600">+${fmt(y.totalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空狀態 */}
        {dividends.length === 0 && !adding && (
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              💰
            </div>
            <div className="text-base font-extrabold text-stone-600 mb-2">
              {techMode ? '尚無股息紀錄' : '還沒有股息紀錄'}
            </div>
            <div className="text-xs text-stone-400 leading-relaxed mb-4">
              {techMode
                ? '點擊右上角「新增」開始記錄'
                : '領到股息時，記一筆下來，這裡會幫你自動加總'}
            </div>
            <button
              onClick={() => setAdding(true)}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              新增第一筆股息
            </button>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
