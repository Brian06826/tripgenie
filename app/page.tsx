import { ChatInput } from '@/components/ChatInput'
import { ExampleTripLink } from '@/components/ExampleTripLink'

const EXAMPLE_TRIPS = [
  {
    title: 'Long Beach Day Trip 🌊',
    subtitle: 'Couple · Highly-rated restaurants · Scenic waterfront',
    href: '/trip/example-longbeach',
  },
  {
    title: 'San Diego 5-Day Getaway 🐬',
    subtitle: 'SeaWorld · Seafood · Old Town',
    href: '/trip/example-sandiego',
  },
  {
    title: 'Tokyo Food Adventure 🍣',
    subtitle: '3 days · Tsukiji · Ramen · Izakaya',
    href: '/trip/example-tokyo',
  },
  {
    title: 'San Francisco Weekend 🌉',
    subtitle: '2 days · Family · Golden Gate · Wharf',
    href: '/trip/example-sf',
  },
  {
    title: 'Taipei Night Market Tour 🧋',
    subtitle: '2 days · Couple · Shilin · Jiufen',
    href: '/trip/example-taipei',
  },
  {
    title: 'New York City Explorer 🗽',
    subtitle: '3 days · Packed · Manhattan · Brooklyn',
    href: '/trip/example-nyc',
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
            <ExampleTripLink
              key={trip.href}
              href={trip.href}
              title={trip.title}
              subtitle={trip.subtitle}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
