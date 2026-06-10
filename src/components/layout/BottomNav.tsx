'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/',          icon: '⊞', label: '首頁'  },
  { href: '/analyze',   icon: '🔍', label: '分析'  },
  { href: '/portfolio', icon: '📋', label: '持股'  },
  { href: '/trades',    icon: '📒', label: '紀錄'  },
  { href: '/settings',  icon: '⚙️', label: '設定'  },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-stone-200 z-50">
      <div className="max-w-lg mx-auto flex">
        {TABS.map(({ href, icon, label }) => {
          const active = path === href || (href !== '/' && path.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                active ? 'text-amber-500' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
