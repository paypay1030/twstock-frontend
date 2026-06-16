import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'
import GlobalHeader from '@/components/layout/GlobalHeader'
import MigrateOnMount from '@/components/layout/MigrateOnMount'

export const metadata: Metadata = {
  title: '我的持股管家',
  description: '台股個人投資分析助手｜所有分析均為機率與風險評估，不保證股價走勢。',
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="font-sans antialiased bg-[#F7F5F3] text-stone-900 min-h-screen">
        {/* 啟動時執行 LocalStorage 版本遷移 */}
        <MigrateOnMount />
        <GlobalHeader />
        <main className="pb-20 pt-12 max-w-lg mx-auto">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
