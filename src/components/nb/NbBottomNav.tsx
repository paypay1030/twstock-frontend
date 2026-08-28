'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',          icon: '⌂',  label: '首頁'  },
  { href: '/portfolio', icon: '◫',  label: '持股'  },
  { href: '/analyze',   icon: '⊙',  label: '分析'  },
  { href: '/trades',    icon: '≡',  label: '紀錄'  },
  { href: '/settings',  icon: '◎',  label: '設定'  },
]

export default function NbBottomNav() {
  const path = usePathname()

  return (
    <nav className="
      shrink-0 z-40
      bg-nb-footer border-t border-nb-border
      pb-[env(safe-area-inset-bottom,0px)]
    ">
      <div className="flex">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex-1 flex flex-col items-center gap-0.5
                py-2 pb-2.5
                transition-opacity duration-150
                ${active ? 'opacity-100' : 'opacity-35'}
              `}
            >
              {/* Icon */}
              <span className="text-[19px] leading-none select-none">{icon}</span>
              {/* Label */}
              <span className={`
                text-[10px] font-extrabold tracking-wide select-none
                ${active ? 'text-nb-t0' : 'text-nb-t3'}
              `}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
