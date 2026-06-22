'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useSettingsStore } from '@/stores'
import { useUIStore } from '@/stores/ui'
import { exportBackup, importBackup, type ImportResult } from '@/lib/backup'

// ── 總資金設定卡 ─────────────────────────────────────────────
function FundSettingCard() {
  const { totalFund, setTotalFund } = useSettingsStore()
  const { techMode } = useUIStore()
  const [input, setInput] = useState(totalFund > 0 ? String(totalFund) : '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    const v = parseFloat(input)
    if (isNaN(v) || v < 0) return
    setTotalFund(v)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div className="text-sm font-extrabold text-stone-800 mb-1">
        {techMode ? '總資金設定' : '我總共有多少錢可以投資？'}
      </div>
      <p className="text-xs text-stone-400 mb-3 leading-relaxed">
        {techMode
          ? '用於計算現金部位與資產比例圖。現金 = 總資金 − 目前持股市值。'
          : '填入後，首頁會幫你算出「現金」還剩多少，以及股票、ETF、現金各佔多少比例。'}
      </p>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="例如：500000"
            className="w-full h-11 pl-7 pr-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-300"
          />
        </div>
        <button
          onClick={handleSave}
          className="px-5 h-11 bg-amber-400 hover:bg-amber-500 text-white text-sm font-extrabold rounded-xl shadow-sm transition-colors flex-shrink-0"
        >
          {saved ? '✓ 已儲存' : '儲存'}
        </button>
      </div>
      {totalFund > 0 && (
        <div className="mt-2 text-xs text-stone-400">
          目前設定：${totalFund.toLocaleString('zh-TW')} 元
        </div>
      )}
    </div>
  )
}

// ── 資料備份還原卡 ───────────────────────────────────────────
function BackupRestoreCard() {
  const { techMode } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const handleExport = () => {
    exportBackup()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setConfirming(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const confirmImport = async () => {
    if (!pendingFile) return
    setImporting(true)
    setConfirming(false)
    try {
      const text = await pendingFile.text()
      const res = importBackup(text)
      setResult(res)
      if (res.ok) {
        setTimeout(() => window.location.reload(), 1800)
      }
    } catch {
      setResult({ ok: false, error: '讀取檔案失敗，請重試。' })
    } finally {
      setImporting(false)
      setPendingFile(null)
    }
  }

  const cancelImport = () => {
    setConfirming(false)
    setPendingFile(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div className="text-sm font-extrabold text-stone-800 mb-1">
        {techMode ? '資料備份與還原' : '備份我的資料'}
      </div>
      <p className="text-xs text-stone-400 mb-4 leading-relaxed">
        {techMode
          ? '所有資料僅存於本機瀏覽器，清除快取或更換裝置會遺失。建議定期匯出備份。'
          : '你的持股、交易紀錄都只存在這台手機/電腦裡。換手機、清快取資料就會不見，記得定期備份！'}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={handleExport}
          className="flex flex-col items-center gap-1 py-3.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors"
        >
          <span className="text-xl">📤</span>
          <span className="text-xs font-bold text-stone-700">匯出資料</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex flex-col items-center gap-1 py-3.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors disabled:opacity-50"
        >
          <span className="text-xl">📥</span>
          <span className="text-xs font-bold text-stone-700">
            {importing ? '匯入中…' : '匯入資料'}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {confirming && pendingFile && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-3">
          <div className="text-xs font-bold text-amber-700 mb-1.5">⚠️ 確定要匯入嗎？</div>
          <p className="text-[11px] text-amber-600 leading-relaxed mb-3">
            匯入「{pendingFile.name}」將會<strong>覆蓋</strong>目前所有持股、交易紀錄、股息與自選股資料，此動作無法復原。
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmImport}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
            >
              確定覆蓋匯入
            </button>
            <button
              onClick={cancelImport}
              className="flex-1 py-2 bg-white border border-amber-200 text-amber-600 text-xs font-bold rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`rounded-xl p-3 text-xs leading-relaxed ${
          result.ok
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-600'
        }`}>
          {result.ok ? (
            <>
              ✓ 匯入成功！交易紀錄 {result.summary.trades} 筆、股息 {result.summary.dividends} 筆、自選股 {result.summary.watchlist} 檔
              <br />
              <span className="opacity-75">頁面即將自動重新整理…</span>
            </>
          ) : (
            <>⚠ {result.error}</>
          )}
        </div>
      )}
    </div>
  )
}

// ── 減碼規則卡（既有功能，補上 UI）───────────────────────────
function TrimRulesCard() {
  const { trimRules, setTrimRules } = useSettingsStore()
  const { techMode } = useUIStore()

  const RULES: { key: keyof typeof trimRules; label: string; plainLabel: string }[] = [
    { key: 'near_resist',   label: '接近賣點區', plainLabel: '快到高點時' },
    { key: 'in_resist',     label: '進入賣點區', plainLabel: '已經到高點時' },
    { key: 'fail_breakout', label: '突破失敗',   plainLabel: '漲上去又跌回來時' },
    { key: 'break_support', label: '跌破買點區', plainLabel: '跌破停損時' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div className="text-sm font-extrabold text-stone-800 mb-1">
        {techMode ? '減碼規則設定' : '不同情況下，建議賣多少？'}
      </div>
      <p className="text-xs text-stone-400 mb-3 leading-relaxed">
        套用於持股管理頁「賣多少」試算的預設比例。
      </p>
      <div className="space-y-3">
        {RULES.map(({ key, label, plainLabel }) => (
          <div key={key}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-stone-600">
                {techMode ? label : plainLabel}
              </span>
              <span className="text-sm font-extrabold text-amber-600 tabular-nums">
                {Math.round(trimRules[key] * 100)}%
              </span>
            </div>
            <input
              type="range" min="5" max="100" step="5"
              value={Math.round(trimRules[key] * 100)}
              onChange={e => setTrimRules({ [key]: parseInt(e.target.value) / 100 })}
              className="w-full accent-amber-400"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function SettingsPage() {
  const { techMode } = useUIStore()

  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <h1 className="text-2xl font-extrabold text-stone-900">
          {techMode ? '設定' : '我的設定'}
        </h1>

        {/* 快速入口 */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/dividends"
            className="flex items-center gap-2.5 px-4 py-3.5 bg-white border border-stone-100 shadow-sm rounded-2xl hover:border-amber-200 transition-colors"
          >
            <span className="text-xl">💰</span>
            <div>
              <div className="text-xs font-extrabold text-stone-700">股息中心</div>
              <div className="text-[10px] text-stone-400">追蹤配息收入</div>
            </div>
          </Link>
          <Link
            href="/watchlist"
            className="flex items-center gap-2.5 px-4 py-3.5 bg-white border border-stone-100 shadow-sm rounded-2xl hover:border-amber-200 transition-colors"
          >
            <span className="text-xl">⭐</span>
            <div>
              <div className="text-xs font-extrabold text-stone-700">自選股</div>
              <div className="text-[10px] text-stone-400">追蹤關注股票</div>
            </div>
          </Link>
        </div>

        <FundSettingCard />
        <BackupRestoreCard />
        <TrimRulesCard />

        <div className="text-center text-[10px] text-stone-300 pb-4 leading-relaxed">
          所有資料僅儲存於本機瀏覽器，不會上傳至任何伺服器。
        </div>
      </div>
    </div>
  )
}
