import { ChatInput } from '@/components/ChatInput'
import { ExampleTripLink } from '@/components/ExampleTripLink'
import { RecentTrips } from '@/components/RecentTrips'

const EXAMPLE_TRIPS = [
  {
    title: 'Long Beach Day Trip',
    subtitle: 'Couple · Highly-rated restaurants · Scenic waterfront',
    href: '/trip/example-longbeach',
    flag: '🇺🇸',
    gradient: 'from-sky-500 to-blue-600',
  },
  {
    title: 'San Diego 5-Day Getaway',
    subtitle: 'SeaWorld · Seafood · Old Town',
    href: '/trip/example-sandiego',
    flag: '🇺🇸',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    title: 'Tokyo Food Adventure',
    subtitle: '3 days · Tsukiji · Ramen · Izakaya',
    href: '/trip/example-tokyo',
    flag: '🇯🇵',
    gradient: 'from-rose-400 to-pink-600',
  },
  {
    title: 'San Francisco Weekend',
    subtitle: '2 days · Family · Golden Gate · Wharf',
    href: '/trip/example-sf',
    flag: '🇺🇸',
    gradient: 'from-orange-400 to-red-500',
  },
  {
    title: 'Taipei Night Market Tour',
    subtitle: '2 days · Couple · Shilin · Jiufen',
    href: '/trip/example-taipei',
    flag: '🇹🇼',
    gradient: 'from-emerald-400 to-teal-600',
  },
  {
    title: 'New York City Explorer',
    subtitle: '3 days · Packed · Manhattan · Brooklyn',
    href: '/trip/example-nyc',
    flag: '🇺🇸',
    gradient: 'from-violet-400 to-indigo-600',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Hero header */}
      <header
        className="text-white px-4 pt-14 pb-10 text-center"
        style={{ background: 'linear-gradient(180deg, var(--color-navy-dark) 0%, var(--color-navy) 60%, var(--color-navy-mid) 100%)' }}
      >
        <div className="max-w-xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
            Trip<span className="text-orange">Genie</span> <span className="text-3xl sm:text-4xl">✨</span>
          </h1>
          <p className="text-base sm:text-lg font-medium opacity-90 mb-2">
            Your AI-Powered Trip Planner
          </p>
          <p className="text-sm opacity-60">
            自然語言輸入，自動生成靚嘅行程
          </p>
        </div>
      </header>

      {/* Trust indicators */}
      <div className="max-w-xl lg:max-w-3xl mx-auto px-4 -mt-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-around gap-2 text-center">
          <div>
            <p className="text-xs font-semibold text-gray-700">AI-Powered</p>
            <p className="text-[10px] text-gray-400">Claude AI</p>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Google Verified</p>
            <p className="text-[10px] text-gray-400">Ratings & Maps</p>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div>
            <p className="text-xs font-semibold text-gray-700">100+ Cities</p>
            <p className="text-[10px] text-gray-400">Worldwide</p>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div>
            <p className="text-xs font-semibold text-gray-700">⚡ Instant</p>
            <p className="text-[10px] text-gray-400">Results in seconds</p>
          </div>
        </div>
      </div>

      {/* Chat input in card */}
      <section className="max-w-xl lg:max-w-3xl mx-auto px-4 pt-6 pb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-8">
          <p className="text-sm lg:text-base font-medium text-gray-600 mb-3 lg:mb-4">
            Describe your dream trip...
          </p>
          <ChatInput />
        </div>
      </section>

      {/* Recent trips from localStorage */}
      <RecentTrips />

      {/* Example trips */}
      <section className="max-w-xl mx-auto px-4 pb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          範例行程 / Example Trips
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {EXAMPLE_TRIPS.map(trip => (
            <ExampleTripLink
              key={trip.href}
              href={trip.href}
              title={trip.title}
              subtitle={trip.subtitle}
              flag={trip.flag}
              gradient={trip.gradient}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-gray-200 bg-white">
        <p className="text-sm text-gray-500">
          Made with ❤️ by <span className="font-semibold text-navy">TripGenie</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Powered by Claude AI
        </p>
      </footer>
    </div>
  )
}
