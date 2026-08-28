'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import TodayNoteCard from '@/components/nb/TodayNoteCard'
import NbBadge from '@/components/nb/NbBadge'
import { useTradeStore, useDividendStore, calcHoldingStats } from '@/stores'
import { useWatchlistStore } from '@/stores'
import { useUIStore, useTodayNoteStore } from '@/stores/ui'
import { calcTotalDividendIncome } from '@/lib/dividend-stats'
import { calcTotalReturn } from '@/lib/fee-calculator'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

export default function HomePage() {
  const { trades } = useTradeStore()
  const { dividends } = useDividendStore()
  const { watchlist } = useWatchlistStore()
  const { techMode } = useUIStore()
  // TodayNoteProvider（在 layout）負責取得與更新，這裡只讀取
  const { note: todayNote } = useTodayNoteStore()

  // 計算資產摘要
  const totalDividend = useMemo(() => calcTotalDividendIncome(dividends), [dividends])
  const totalRealized = useMemo(() => {
    const byCode: Record<string, typeof trades> = {}
    trades.forEach(t => { if (!byCode[t.code]) byCode[t.code] = []; byCode[t.code].push(t) })
    return Object.entries(byCode).reduce((s, [code]) => {
      const name = byCode[code][0]?.name ?? code
      return s + calcHoldingStats(code, name, byCode[code], null).realizedPnL
    }, 0)
  }, [trades])
  const totalReturn = calcTotalReturn(totalRealized, 0, totalDividend)

  // 最近交易 5 筆
  const recentTrades = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)

  return (
    <div className="pb-6 px-4 pt-4 space-y-4">

      {/* ① 今天的小筆記（佔主要版面，60–70%視覺重量）*/}
      <TodayNoteCard data={todayNote} />

      {/* ② 資產總覽（簡潔，次要）*/}
      {trades.length > 0 && (
        <div className="
          bg-nb-s0 border border-nb-border rounded-2xl p-4 shadow-nb
        ">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold text-nb-t2 tracking-widest uppercase">
              {techMode ? '資產概況' : '我的資產'}
            </span>
            <Link href="/portfolio" className="text-[11px] font-bold text-nb-blue">
              查看持股 →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-0">
            <div className="text-center pr-3 border-r border-nb-border">
              <div className="text-[10px] font-extrabold text-nb-t2 mb-1">
                {techMode ? '已實現損益' : '已落袋'}
              </div>
              <div className={`text-[16px] font-black ${totalRealized >= 0 ? 'text-nb-up' : 'text-nb-down'}`}>
                {totalRealized >= 0 ? '+' : ''}{fmt(totalRealized)}
              </div>
            </div>
            <div className="text-center px-2 border-r border-nb-border">
              <div className="text-[10px] font-extrabold text-nb-t2 mb-1">股息</div>
              <div className="text-[16px] font-black text-nb-down">
                +{fmt(totalDividend)}
              </div>
            </div>
            <div className="text-center pl-3">
              <div className="text-[10px] font-extrabold text-nb-t2 mb-1">
                {techMode ? '真正總報酬' : '總計'}
              </div>
              <div className={`text-[16px] font-black ${totalReturn.totalReturn >= 0 ? 'text-nb-up' : 'text-nb-down'}`}>
                {totalReturn.totalReturn >= 0 ? '+' : ''}{fmt(totalReturn.totalReturn)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ③ 自選股（橫向捲動）*/}
      {watchlist.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-nb-t2 tracking-widest uppercase">
              自選股
            </span>
            <Link href="/watchlist" className="text-[11px] font-bold text-nb-blue">
              管理 →
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
            {watchlist.slice(0, 6).map(w => (
              <Link
                key={w.id}
                href={`/analyze?q=${w.code}`}
                className="
                  flex-shrink-0 w-[88px]
                  bg-nb-s0 border border-nb-border
                  rounded-[13px] p-2.5 shadow-nb
                "
              >
                <div className="text-[10px] font-extrabold text-nb-t3">{w.code}</div>
                <div className="text-[12px] font-extrabold text-nb-t0 my-1 leading-tight line-clamp-2">
                  {w.name}
                </div>
                <div className="text-[10px] font-bold text-nb-t3">點擊分析</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ④ 最近瀏覽（次要，讓使用者快速回到熟悉的股票）*/}
      {recentTrades.length > 0 && (
        <div>
          <div className="text-[10px] font-extrabold text-nb-t2 tracking-widest uppercase mb-2">
            最近紀錄
          </div>
          <div className="bg-nb-s0 border border-nb-border rounded-2xl overflow-hidden shadow-nb">
            {recentTrades.map((t, i) => (
              <Link
                key={t.id}
                href={`/analyze?q=${t.code}`}
                className={`
                  flex items-center justify-between px-4 py-3
                  ${i < recentTrades.length - 1 ? 'border-b border-nb-border' : ''}
                `}
              >
                <div>
                  <div className="text-[13px] font-extrabold text-nb-t0">{t.name}</div>
                  <div className="text-[11px] text-nb-t3 mt-0.5">{t.code} · {t.date}</div>
                </div>
                <div className="text-right">
                  <NbBadge
                    variant={t.type === 'buy' || t.type === 'add' ? 'green' : 'orange'}
                    dot={false}
                  >
                    {t.type === 'buy' ? '買進' : t.type === 'add' ? '加碼' : t.type === 'reduce' ? '減碼' : '賣出'}
                  </NbBadge>
                  <div className="text-[12px] font-extrabold text-nb-t0 mt-1">
                    {t.price} 元
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 空狀態引導 */}
      {trades.length === 0 && (
        <div className="
          bg-nb-s0 border border-nb-border rounded-2xl p-6 text-center shadow-nb
        ">
          <div className="text-3xl mb-3">📒</div>
          <div className="text-[14px] font-extrabold text-nb-t0 mb-1.5">
            歡迎來到小本本
          </div>
          <div className="text-[12px] text-nb-t2 leading-relaxed mb-4">
            先新增一筆持股或交易紀錄，<br/>讓 AI 幫你追蹤每天的狀況。
          </div>
          <Link
            href="/portfolio"
            className="
              inline-block px-5 py-2.5
              bg-nb-t0 text-nb-s0 text-[13px] font-extrabold
              rounded-xl
            "
          >
            新增第一筆持股
          </Link>
        </div>
      )}
    </div>
  )
}
