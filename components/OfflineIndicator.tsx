'use client'

// Thin banner that appears whenever the WebView reports it has lost network.
// Renders nothing on the server and nothing while online.
import { useEffect, useState } from 'react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

export function OfflineIndicator() {
  const [online, setOnline] = useState(true)
  const [mounted, setMounted] = useState(false)
  const { locale } = useUILocale()

  useEffect(() => {
    setMounted(true)
    if (typeof navigator !== 'undefined') {
      setOnline(navigator.onLine)
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (!mounted || online) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 w-full bg-amber-100 border-b border-amber-200 text-amber-900 text-xs text-center py-1.5 px-3"
    >
      <span className="font-medium">📡 {t(locale, 'offline.indicator')}</span>
    </div>
  )
}
