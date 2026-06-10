'use client'

import { useState, useEffect } from 'react'
import type { TradeType, ConfidenceLevel } from '@/types'
import { TRADE_META, CONFIDENCE_META } from '@/types'

interface Props {
  code: string
  name: string
  currentPrice?: number
  suggestedType?: TradeType
  onSave: (t: Omit<import('@/types').TradeRecord, 'id'>) => void
  onCancel: () => void
}

export default function TradeForm({ code, name, currentPrice, suggestedType = 'buy', onSave, onCancel }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [type, setType]         = useState<TradeType>(suggestedType)
  const [price, setPrice]       = useState(currentPrice ? String(currentPrice) : '')
  const [shares, setShares]     = useState('')
  const [date, setDate]         = useState(today)
  const [note, setNote]         = useState('')
  const [reason, setReason]     = useState('')
  const [confidence, setConf]   = useState<ConfidenceLevel>(2)
  const [showJournal, setShowJ] = useState(false)
  const [manualType, setManual] = useState(false)

  useEffect(() => { if (!manualType) setType(suggestedType) }, [suggestedType, manualType])

  const isBuySide = type === 'buy' || type === 'add'
  const amount    = price && shares ? Math.round(parseFloat(price) * parseInt(shares)) : 0
  const valid     = !!price && !!shares && !!date && parseFloat(price) > 0 && parseInt(shares) > 0

  const handleSave = () => {
    if (!valid) return
    onSave({
      code, name, type,
      price:  parseFloat(price),
      shares: parseInt(shares),
      date, note: note || undefined,
      journal: showJournal && reason
        ? { reason, confidence }
        : undefined,
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      {/* 標題 */}
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
        <div>
          <span className="text-sm font-bold text-stone-800">新增交易紀錄</span>
          <span className="text-xs text-stone-400 ml-2">{name} {code}</span>
        </div>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
      </div>

      <div className="p-4 space-y-3">
        {/* 系統建議提示 */}
        {!manualType && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <span>💡 系統建議：</span>
            <span className="font-bold text-amber-700">{TRADE_META[suggestedType].label}</span>
            <span className="text-stone-400">（可手動切換）</span>
          </div>
        )}

        {/* 四種類型 */}
        <div className="grid grid-cols-4 gap-1.5">
          {(['buy','add','reduce','sell'] as TradeType[]).map(t => {
            const m = TRADE_META[t]
            return (
              <button key={t}
                onClick={() => { setType(t); setManual(true) }}
                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  type === t
                    ? `${m.badgeBg} ${m.badgeText} border-transparent`
                    : 'bg-white text-stone-400 border-stone-200'
                }`}
              >{m.label}</button>
            )
          })}
        </div>

        {/* 價格 + 股數 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-stone-400 mb-1 block">{TRADE_META[type].label}價格</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="例：57.03" step="0.01"
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">股數</label>
            <input type="number" value={shares} onChange={e => setShares(e.target.value)}
              placeholder="例：1000"
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* 預估金額 */}
        {amount > 0 && (
          <div className="text-center text-xs text-stone-500">
            {isBuySide ? '預計投入' : '預計回收'}：
            <span className="font-bold text-stone-700 ml-1">${amount.toLocaleString()} 元</span>
          </div>
        )}

        {/* 日期 */}
        <div>
          <label className="text-xs text-stone-400 mb-1 block">交易日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 focus:bg-white"
          />
        </div>

        {/* 備註 */}
        <div>
          <label className="text-xs text-stone-400 mb-1 block">備註（選填）</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="例：季線支撐附近分批買進"
            className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-300 focus:bg-white"
          />
        </div>

        {/* 投資日誌 */}
        <button onClick={() => setShowJ(!showJournal)}
          className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold w-full py-1"
        >
          <span className="text-stone-300">{showJournal ? '▼' : '▶'}</span>
          {showJournal ? '收起投資日誌' : '＋ 新增投資日誌（選填）'}
        </button>

        {showJournal && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
            <div>
              <label className="text-xs font-bold text-amber-700 mb-1.5 block">
                {TRADE_META[type].label}原因
              </label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                rows={2} placeholder="例：接近支撐區，量縮整理，分批布局"
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm resize-none focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-amber-700 mb-2 block">當時信心程度</label>
              <div className="grid grid-cols-3 gap-2">
                {([1,2,3] as ConfidenceLevel[]).map(c => {
                  const m = CONFIDENCE_META[c]
                  return (
                    <button key={c} onClick={() => setConf(c)}
                      className={`py-2 rounded-xl border text-center text-xs font-medium transition-all ${
                        confidence === c
                          ? 'border-amber-400 bg-white text-amber-800 ring-2 ring-amber-200'
                          : 'border-stone-200 bg-white text-stone-500'
                      }`}
                    >
                      <div className="text-lg mb-0.5">{m.icon}</div>
                      <div className="font-bold">{m.label}</div>
                      <div className="text-[9px] text-stone-400 mt-0.5">{m.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 儲存按鈕 */}
        <button onClick={handleSave} disabled={!valid}
          className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold rounded-xl text-sm transition-colors"
        >
          儲存紀錄
        </button>
      </div>
    </div>
  )
}
