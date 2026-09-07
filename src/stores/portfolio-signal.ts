/**
 * 持股燈號全域 Store
 *
 * 設計意圖：
 *   - 持股頁（/portfolio）呼叫 analyzeStock 取得燈號後，寫入此 Store
 *   - 首頁讀取此 Store，用燈號分佈產生個人化「今日筆記」
 *   - 避免首頁重複呼叫 API，資料只取一次，兩頁共用
 *   - 非持久化：燈號應每次開啟 App 重新取得，不快取到 LocalStorage
 */

import { create } from 'zustand'
import type { SignalColor } from '@/types'

export interface PortfolioSignal {
  code: string
  name: string
  color: SignalColor
  action: string
  currentShares: number
  unrealizedPnLPct?: number | null
  // Phase 19：支撐壓力與現價（來自 fetchAnalysis 後的 srMap / statsMap）
  nearestSupport?: number | null   // 第一支撐位（元）
  nearestResist?:  number | null   // 第一壓力位（元）
  currentPrice?:   number | null   // 目前股價（元）
}

interface PortfolioSignalStore {
  signals: PortfolioSignal[]
  setSignals: (signals: PortfolioSignal[]) => void
  updateSignal: (signal: PortfolioSignal) => void
}

export const usePortfolioSignalStore = create<PortfolioSignalStore>()((set) => ({
  signals: [],
  setSignals: (signals) => set({ signals }),
  updateSignal: (signal) => set(state => {
    const existing = state.signals.findIndex(s => s.code === signal.code)
    if (existing >= 0) {
      const updated = [...state.signals]
      updated[existing] = signal
      return { signals: updated }
    }
    return { signals: [...state.signals, signal] }
  }),
}))
