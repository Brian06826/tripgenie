import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tripgenie.app'),
  title: 'TripGenie — AI 旅行行程規劃器',
  description: '用 AI 生成靚嘅可分享旅行行程，專為美國華人設計。Google + Yelp 雙評分，泊車資訊，一鍵分享。',
  openGraph: {
    title: 'TripGenie — AI Travel Planner',
    description: 'AI-powered travel itinerary generator for Chinese-American travelers. Dual Google + Yelp ratings, parking info, shareable via WeChat.',
    images: [{ url: '/og-fallback.png', width: 1200, height: 630 }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-HK" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
