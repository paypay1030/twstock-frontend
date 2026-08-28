/**
 * TodayNoteProvider
 *
 * Client Component，負責：
 *   1. App 啟動後向 /api/today-note 取得今日筆記
 *   2. 寫入 useTodayNoteStore（session-only，不進 LocalStorage）
 *   3. 持股燈號更新時，用 generateTodayNote() 覆蓋（個人化優先）
 *
 * 放在 layout.tsx，確保所有頁面載入前資料已就位。
 * TodayNoteCard 只負責顯示，完全不知道資料從哪裡來。
 */
'use client'

import { useEffect, useRef } from 'react'
import { useTodayNoteStore } from '@/stores/ui'
import { usePortfolioSignalStore } from '@/stores/portfolio-signal'
import { generateTodayNote } from '@/lib/ai-note-generator'
import { getTodayNote } from '@/lib/api'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000  // 5 分鐘後允許重新取得

export default function TodayNoteProvider() {
  const { setTodayNote } = useTodayNoteStore()
  const { signals } = usePortfolioSignalStore()
  const lastFetchedAt = useRef<number>(0)
  const hasFetched    = useRef(false)

  // ── Step 1：App 啟動後取得 API 筆記（全局預設）──────────────
  useEffect(() => {
    const now = Date.now()
    if (hasFetched.current && now - lastFetchedAt.current < REFRESH_INTERVAL_MS) return

    hasFetched.current = true
    lastFetchedAt.current = now

    getTodayNote()
      .then(data => {
        // 只有在「還沒有個人化燈號資料」的情況下套用 API 預設值
        if (usePortfolioSignalStore.getState().signals.length === 0) {
          const { generatedAt: _g, source: _s, ...noteData } = data
          setTodayNote(noteData)
        }
      })
      .catch(() => {
        // API 失敗時維持 Store 現有內容（DEFAULT_NOTE 或個人化筆記）
      })
  }, [setTodayNote])

  // ── Step 2：持股燈號更新時，產生個人化筆記（優先度最高）────
  useEffect(() => {
    if (signals.length === 0) return
    const personalNote = generateTodayNote(signals)
    setTodayNote(personalNote)
  }, [signals, setTodayNote])

  return null
}
