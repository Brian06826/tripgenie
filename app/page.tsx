import Link from 'next/link'
import { headers } from 'next/headers'
import { ChatInput } from '@/components/ChatInput'
import { ExampleTripLink } from '@/components/ExampleTripLink'
import { ProductPreview } from '@/components/ProductPreview'
import { RecentTrips } from '@/components/RecentTrips'
import { TripCounter } from '@/components/TripCounter'
import { UserMenu } from '@/components/UserMenu'

const EXAMPLE_TRIPS = [
  {
    title: 'Long Beach Day Trip',
    subtitle: 'Couple · Seafood · Waterfront',
    href: '/trip/example-longbeach',
    flag: '🇺🇸',
    gradient: 'from-sky-500 to-blue-600',
    stops: 6,
    avgRating: 4.4,
  },
  {
    title: 'San Diego 5-Day Getaway',
    subtitle: '5 Days · SeaWorld · Old Town',
    href: '/trip/example-sandiego',
    flag: '🇺🇸',
    gradient: 'from-amber-400 to-orange-500',
    stops: 25,
    avgRating: 4.5,
  },
  {
    title: 'Tokyo Food Adventure',
    subtitle: '3 Days · Ramen · Temples',
    href: '/trip/example-tokyo',
    flag: '🇯🇵',
    gradient: 'from-rose-400 to-pink-600',
    stops: 20,
    avgRating: 4.5,
  },
  {
    title: 'San Francisco Weekend',
    subtitle: 'Family · Golden Gate · Wharf',
    href: '/trip/example-sf',
    flag: '🇺🇸',
    gradient: 'from-orange-400 to-red-500',
    stops: 12,
    avgRating: 4.4,
  },
  {
    title: 'Taipei Night Market Tour',
    subtitle: 'Night Markets · Shilin · Jiufen',
    href: '/trip/example-taipei',
    flag: '🇹🇼',
    gradient: 'from-emerald-400 to-teal-600',
    stops: 10,
    avgRating: 4.3,
  },
  {
    title: 'New York City Explorer',
    subtitle: 'Manhattan · Brooklyn · Food',
    href: '/trip/example-nyc',
    flag: '🇺🇸',
    gradient: 'from-violet-400 to-indigo-600',
    stops: 18,
    avgRating: 4.5,
  },
]

export default async function HomePage() {
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language') ?? ''
  const isZh = /^zh\b/i.test(acceptLang) || /,\s*zh\b/i.test(acceptLang)

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Hero header */}
      <header
        className="text-white px-4 pt-10 pb-12 text-center relative z-0"
        style={{ background: 'linear-gradient(180deg, var(--color-navy-dark) 0%, var(--color-navy) 60%, var(--color-navy-mid) 100%)' }}
      >
        <div className="absolute top-4 right-4">
          <UserMenu />
        </div>
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Lul<span className="text-orange">go</span> <span className="text-2xl sm:text-3xl">✨</span>
          </h1>
          <p className="text-base sm:text-lg font-semibold opacity-95">
            {isZh ? '懶人專屬旅行規劃。' : 'The laziest way to plan a trip.'}
          </p>
        </div>
      </header>

      {/* Trip counter */}
      <div className="max-w-xl lg:max-w-3xl mx-auto px-4 -mt-3 relative z-10">
        <TripCounter />
      </div>

      {/* Chat input in card */}
      <section className="max-w-xl lg:max-w-3xl mx-auto px-4 pt-4 pb-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6">
          <ChatInput browserLang={isZh ? 'zh' : 'en'} />
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-xl lg:max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl mb-1">💬</div>
            <p className="text-xs font-semibold text-gray-700">{isZh ? '描述行程' : 'Describe'}</p>
            <p className="text-[10px] text-gray-400">{isZh ? '任何語言都得' : 'Any language'}</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🤖</div>
            <p className="text-xs font-semibold text-gray-700">{isZh ? 'AI 規劃' : 'AI Plans'}</p>
            <p className="text-[10px] text-gray-400">{isZh ? '餐廳已驗證' : 'Verified spots'}</p>
          </div>
          <div>
            <div className="text-2xl mb-1">✏️</div>
            <p className="text-xs font-semibold text-gray-700">{isZh ? '編輯出發' : 'Edit & Go'}</p>
            <p className="text-[10px] text-gray-400">{isZh ? '隨時修改' : 'Modify anytime'}</p>
          </div>
        </div>
      </section>

      {/* Product preview — show what a real itinerary looks like */}
      <ProductPreview isZh={isZh} />

      {/* Recent trips from localStorage */}
      <RecentTrips />

      {/* Example trips */}
      <section className="max-w-xl mx-auto px-4 pb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {isZh ? '範例行程' : 'Example Trips'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXAMPLE_TRIPS.map(trip => (
            <ExampleTripLink
              key={trip.href}
              href={trip.href}
              title={trip.title}
              subtitle={trip.subtitle}
              flag={trip.flag}
              gradient={trip.gradient}
              stops={trip.stops}
              avgRating={trip.avgRating}
              isZh={isZh}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-gray-200 bg-white space-y-2">
        <p className="text-sm text-gray-500">
          Made with ❤️ using AI · © 2026 Lulgo
        </p>
        <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">
            {isZh ? '隱私政策' : 'Privacy Policy'}
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">
            {isZh ? '服務條款' : 'Terms'}
          </Link>
        </div>
      </footer>
    </div>
  )
}
