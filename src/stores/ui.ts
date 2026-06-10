/**
 * UI 模式設定 Store
 * techMode: false（預設） = 超白話模式
 *           true          = 技術模式（顯示原始術語）
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  techMode: boolean
  toggleTechMode: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      techMode: false,
      toggleTechMode: () => set((s) => ({ techMode: !s.techMode })),
    }),
    { name: 'twstock-ui' }
  )
)
