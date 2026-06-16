import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
