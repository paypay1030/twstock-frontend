import type { Metadata, Viewport } from 'next'
import './globals.css'
import NbHeader from '@/components/nb/NbHeader'
import NbBottomNav from '@/components/nb/NbBottomNav'
import TodayNoteProvider from '@/components/nb/TodayNoteProvider'

export const metadata: Metadata = {
  title: '小本本',
  description: '你的投資筆記',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '小本本' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FBF7F2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-nb-bg text-nb-t0 antialiased overscroll-none">
        {/* 全站統一 wrapper：最大寬度 + 置中 */}
        <div className="relative min-h-screen max-w-lg mx-auto flex flex-col">

        {/* ── TodayNoteProvider：App 啟動後取得 Today Note 資料 ── */}
          <TodayNoteProvider />

          {/* ── Sticky Header ── */}
          <NbHeader />

          {/* ── 頁面主內容 ── */}
          <main className="flex-1 overflow-y-auto pb-20">
            {children}
          </main>

          {/* ── Sticky Bottom Nav ── */}
          <NbBottomNav />

        </div>
      </body>
    </html>
  )
}
