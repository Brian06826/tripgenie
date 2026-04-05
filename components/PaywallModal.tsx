'use client'
import { useState } from 'react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'
import { signIn, useSession } from 'next-auth/react'

type Props = {
  onClose: () => void
  used: number
  limit: number
}

export function PaywallModal({ onClose, used, limit }: Props) {
  const { locale } = useUILocale()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isSignedIn = !!session?.user

  async function handleBuyPass() {
    if (!isSignedIn) {
      // Sign in first, then redirect back
      signIn('google', { callbackUrl: window.location.href + '?payment=pending' })
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/create-checkout', { method: 'POST' })
      const data = await res.json()

      if (data.error === 'sign_in_required') {
        signIn('google', { callbackUrl: window.location.href + '?payment=pending' })
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(t(locale, 'paywall.error'))
      }
    } catch {
      setError(t(locale, 'paywall.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">✈️</div>
          <h2 className="text-lg font-bold text-gray-900">
            {t(locale, 'paywall.title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t(locale, 'paywall.subtitle', { used: String(used), limit: String(limit) })}
          </p>
        </div>

        {/* Trip Pass card */}
        <div className="border border-orange/30 rounded-xl p-4 mb-4 bg-orange/5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900">Trip Pass</span>
            <span className="text-orange font-bold">$2.99</span>
          </div>
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li>✓ {t(locale, 'paywall.feature1')}</li>
            <li>✓ {t(locale, 'paywall.feature2')}</li>
            <li>✓ {t(locale, 'paywall.feature3')}</li>
          </ul>
        </div>

        {/* Sign-in hint */}
        {!isSignedIn && (
          <p className="text-xs text-gray-400 text-center mb-3">
            {t(locale, 'paywall.signInHint')}
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 text-center mb-3">{error}</p>
        )}

        {/* Actions */}
        <button
          onClick={handleBuyPass}
          disabled={loading}
          className="w-full bg-orange text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading
            ? '...'
            : isSignedIn
              ? t(locale, 'paywall.buy')
              : t(locale, 'paywall.signInAndBuy')
          }
        </button>

        <button
          onClick={onClose}
          className="w-full text-gray-400 text-xs mt-2 py-1 hover:text-gray-600 transition-colors"
        >
          {t(locale, 'paywall.later')}
        </button>

        {/* Reset info */}
        <p className="text-[10px] text-gray-300 text-center mt-3">
          {t(locale, 'paywall.resetNote')}
        </p>
      </div>
    </div>
  )
}
