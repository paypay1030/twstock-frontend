'use client'
import TechModeToggle from '@/components/ui/TechModeToggle'
import { useUIStore } from '@/stores/ui'

export default function GlobalHeader() {
  const { techMode } = useUIStore()
  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-stone-800">我的持股管家</span>
          {!techMode && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">
              超白話模式
            </span>
          )}
        </div>
        <TechModeToggle />
      </div>
    </header>
  )
}
