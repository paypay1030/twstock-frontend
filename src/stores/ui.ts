import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TodayNoteData } from '@/components/nb/TodayNoteCard'

interface UIStore {
  techMode: boolean
  toggleTechMode: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      techMode: false,
      toggleTechMode: () => set(s => ({ techMode: !s.techMode })),
    }),
    {
      name:    'twstock-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// ── 今日筆記 Store（非持久化，每次開啟 App 可由 AI API 刷新）────
//
// 設計意圖：
//   - 預設值為靜態佔位資料，讓 UI 一打開就有內容可顯示
//   - 未來 AI 晨報 API 完成後，呼叫 setTodayNote() 覆蓋即可
//   - 不需 persist：今日筆記應每天重新取得，不應快取到 LocalStorage
//
const DEFAULT_NOTE: TodayNoteData = {
  headline:   '今天不用急著追價。\n市場偏震盪，等待拉回。',
  body:       '今天市場方向還不是很明確，動能也不夠強。我不建議今天追高，容易買在相對高點。',
  reasons: [
    '接近壓力區，這個位置歷史上賣壓比較重',
    '最近交易量沒有很多，上漲動力還不夠',
    '外資連三天買超，但投信開始減少持股',
  ],
  ifIWere:    '如果今天繼續漲，我不會追。\n\n如果拉回到支撐區，我會開始分批考慮布局。',
  actions: [
    '今天不用追價',
    '可以續抱目前持股',
    '等待支撐區再留意布局',
  ],
  riskLevel:  'low',
  riskNote:   '',
  confidence: 'mid',
}

interface TodayNoteStore {
  note: TodayNoteData
  setTodayNote: (note: TodayNoteData) => void   // 供 AI API 呼叫
  resetTodayNote: () => void                     // 重置為預設佔位資料
}

export const useTodayNoteStore = create<TodayNoteStore>()((set) => ({
  note: DEFAULT_NOTE,
  setTodayNote:   (note) => set({ note }),
  resetTodayNote: ()     => set({ note: DEFAULT_NOTE }),
}))

