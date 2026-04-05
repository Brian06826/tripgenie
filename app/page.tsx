import type { Metadata } from 'next'
import { HomeContent } from '@/components/HomeContent'

export const metadata: Metadata = {
  title: 'Lulgo — AI Trip Planner | AI 行程規劃',
  description: 'Plan your perfect trip in seconds with AI. Generate editable, shareable itineraries with Google ratings, local tips, and collaborative editing. Free, no sign-up required. 用 AI 即時生成旅行行程，免登入，可編輯可分享。',
  keywords: ['AI trip planner', 'AI travel planner', 'AI 行程規劃', '旅行規劃', 'travel itinerary generator', 'AI 旅行', 'trip planner free', '行程生成器'],
  openGraph: {
    title: 'Lulgo — AI Trip Planner',
    description: 'Generate beautiful, editable travel itineraries in seconds. No sign-up required.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lulgo — AI Trip Planner',
    description: 'Generate beautiful, editable travel itineraries in seconds. No sign-up required.',
  },
}

export default function HomePage() {
  return <HomeContent />
}
