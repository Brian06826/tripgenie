import Link from 'next/link'
import { ChatInput } from '@/components/ChatInput'

// Pre-built example trips (use real IDs once seeded)
const EXAMPLE_TRIPS = [
  {
    title: 'Long Beach 一日遊 🌊',
    subtitle: '情侶 · Yelp 高分餐廳 · Metro 交通',
    href: '/trip/longbeach-demo',
  },
  {
    title: 'San Diego 5日4夜 🐬',
    subtitle: 'SeaWorld + 海鮮 + Old Town',
    href: '/trip/sandiego-demo',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Hero header */}
      <header
        className="text-white px-4 pt-10 pb-8 text-center"
        style={{ background: 'linear-gradient(180deg, var(--color-navy) 0%, var(--color-navy-mid) 100%)' }}
      >
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-balance">
            Trip<span className="text-orange">Genie</span> ✨
          </h1>
          <p className="text-sm opacity-80 mb-1">AI-Powered Trip Planner | AI 旅行行程規劃器</p>
          <p className="text-xs opacity-60">
            Describe your trip → Beautiful shareable itinerary / 自然語言輸入 → 靚嘅可分享行程頁面
          </p>
        </div>
      </header>

      {/* Chat input */}
      <section className="max-w-xl mx-auto py-6">
        <ChatInput />
      </section>

      {/* Example trips */}
      <section className="max-w-xl mx-auto px-4 pb-12">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          範例行程 / Example Trips
        </h2>
        <div className="space-y-2">
          {EXAMPLE_TRIPS.map(trip => (
            <Link
              key={trip.href}
              href={trip.href}
              className="block bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-orange/30 transition-colors"
            >
              <div className="font-semibold text-gray-900 text-sm">{trip.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{trip.subtitle}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
