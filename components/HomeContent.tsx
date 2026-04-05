'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'
import { ChatInput } from '@/components/ChatInput'
import { ExampleTripLink } from '@/components/ExampleTripLink'
import { RecentTrips } from '@/components/RecentTrips'
import { MyTrips } from '@/components/MyTrips'
import { UserMenu } from '@/components/UserMenu'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

const EXAMPLE_TRIPS = [
  {
    title: 'Tokyo Food Adventure',
    subtitle: '3 Days · Ramen · Temples',
    href: '/trip/example-tokyo',
    flag: '🇯🇵',
    gradient: 'from-rose-400 to-pink-600',
    imageUrl: '/trips/tokyo.jpg',
    stops: 20,
    avgRating: 4.5,
  },
  {
    title: 'San Diego 5-Day Getaway',
    subtitle: '5 Days · SeaWorld · Old Town',
    href: '/trip/example-sandiego',
    flag: '🇺🇸',
    gradient: 'from-amber-400 to-orange-500',
    imageUrl: '/trips/sandiego.jpg',
    stops: 25,
    avgRating: 4.5,
  },
  {
    title: 'Taipei Night Market Tour',
    subtitle: 'Night Markets · Shilin · Jiufen',
    href: '/trip/example-taipei',
    flag: '🇹🇼',
    gradient: 'from-emerald-400 to-teal-600',
    imageUrl: '/trips/taipei.jpg',
    stops: 10,
    avgRating: 4.3,
  },
  {
    title: 'New York City Explorer',
    subtitle: 'Manhattan · Brooklyn · Food',
    href: '/trip/example-nyc',
    flag: '🇺🇸',
    gradient: 'from-violet-400 to-indigo-600',
    imageUrl: '/trips/nyc.jpg',
    stops: 18,
    avgRating: 4.5,
  },
  {
    title: 'Long Beach Day Trip',
    subtitle: 'Couple · Seafood · Waterfront',
    href: '/trip/example-longbeach',
    flag: '🇺🇸',
    gradient: 'from-sky-500 to-blue-600',
    imageUrl: '/trips/longbeach.jpg',
    stops: 6,
    avgRating: 4.4,
  },
  {
    title: 'San Francisco Weekend',
    subtitle: 'Family · Golden Gate · Wharf',
    href: '/trip/example-sf',
    flag: '🇺🇸',
    gradient: 'from-orange-400 to-red-500',
    imageUrl: '/trips/sf.jpg',
    stops: 12,
    avgRating: 4.4,
  },
]

export function HomeContent() {
  const { locale } = useUILocale()
  const [hideRecent, setHideRecent] = useState(false)

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Hero header */}
      <header
        className="text-white px-4 pt-8 pb-6 text-center relative z-0"
        style={{ background: 'linear-gradient(180deg, var(--color-navy-dark) 0%, var(--color-navy) 60%, var(--color-navy-mid) 100%)' }}
      >
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <LanguageSwitcher />
          <UserMenu />
        </div>
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1.5">
            Lul<span className="text-orange">go</span> <span className="text-2xl sm:text-3xl">✨</span>
          </h1>
          <p className="text-base sm:text-lg font-semibold opacity-95 mb-4">
            {t(locale, 'hero.tagline')}
          </p>

          {/* How It Works */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 text-white/60">
            <div className="flex items-center gap-1.5">
              <span className="text-base">💬</span>
              <span className="text-[11px] font-medium">{t(locale, 'hero.step1')}</span>
            </div>
            <span className="text-white/25">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base">🤖</span>
              <span className="text-[11px] font-medium">{t(locale, 'hero.step2')}</span>
            </div>
            <span className="text-white/25">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base">✏️</span>
              <span className="text-[11px] font-medium">{t(locale, 'hero.step3')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat input */}
      <section className="max-w-xl lg:max-w-3xl mx-auto px-4 pt-4 pb-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6">
          <ChatInput />
        </div>
      </section>

      {/* Trust strip */}
      <div className="max-w-xl lg:max-w-3xl mx-auto px-4 pb-3">
        <p className="text-center text-xs text-gray-400">
          {t(locale, 'hero.trust')}
        </p>
      </div>

      {/* Comparison strip */}
      <div className="max-w-xl lg:max-w-3xl mx-auto px-4 pb-4">
        <div className="flex items-center justify-center gap-5 sm:gap-8 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span>🗺️</span> {t(locale, 'comp.map')}
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5">
            <span>⭐</span> {t(locale, 'comp.verified')}
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5">
            <span>✏️</span> {t(locale, 'comp.edit')}
          </span>
        </div>
      </div>

      {/* My Trips (logged-in users only) */}
      <MyTrips onHasTrips={setHideRecent} />

      {/* Recent trips */}
      {!hideRecent && <RecentTrips />}

      {/* Example trips */}
      <section className="max-w-xl lg:max-w-3xl mx-auto px-4 pt-2 pb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2.5">
          {t(locale, 'hero.examples')}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {EXAMPLE_TRIPS.map(trip => (
            <ExampleTripLink
              key={trip.href}
              href={trip.href}
              title={trip.title}
              subtitle={trip.subtitle}
              flag={trip.flag}
              gradient={trip.gradient}
              imageUrl={trip.imageUrl}
              stops={trip.stops}
              avgRating={trip.avgRating}
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
            {t(locale, 'footer.privacy')}
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">
            {t(locale, 'footer.terms')}
          </Link>
        </div>
      </footer>
    </div>
  )
}
