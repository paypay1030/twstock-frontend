'use client'
import { useUIStore } from '@/stores/ui'

export default function TechModeToggle({ className = '' }: { className?: string }) {
  const { techMode, toggleTechMode } = useUIStore()
  return (
    <button
      onClick={toggleTechMode}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
        techMode
          ? 'bg-nb-t1 text-white'
          : 'bg-nb-s4 text-nb-t2 hover:bg-nb-s4'
      } ${className}`}
      title={techMode ? '切換回白話模式' : '切換為技術模式'}
    >
      <span>{techMode ? '📊' : '💬'}</span>
      <span>{techMode ? '技術模式' : '白話模式'}</span>
    </button>
  )
}
