import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'
import GlobalHeader from '@/components/layout/GlobalHeader'

export const metadata: Metadata = {
  title: '我的持股管家',
  description: '台股個人投資分析助手｜所有分析均為機率與風險評估。',
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="font-sans antialiased bg-stone-50 text-stone-800">
        <GlobalHeader />
        <main className="pb-20 pt-12">{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}
