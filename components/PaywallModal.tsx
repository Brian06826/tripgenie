'use client'
import { useState, useEffect } from 'react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'
import { signIn, useSession } from 'next-auth/react'
import { isNative } from '@/lib/native'
import StoreKit, { TRIP_PASS_PRODUCT_ID } from '@/lib/native/store-kit'
import type { StoreKitProduct } from '@/lib/native/store-kit'

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
  const [native, setNative] = useState(false)
  const [iapProduct, setIapProduct] = useState<StoreKitProduct | null>(null)

  const isSignedIn = !!session?.user

  useEffect(() => {
    const n = isNative()
    setNative(n)
    if (n) {
      StoreKit.getProducts({ productIds: [TRIP_PASS_PRODUCT_ID] })
        .then(res => {
          if (res.products.length > 0) setIapProduct(res.products[0])
        })
        .catch(() => {})
    }
  }, [])

  // --- Native IAP flow ---
  async function handleIAPPurchase() {
    if (!isSignedIn) {
      signIn(undefined, { callbackUrl: window.location.href + '?payment=pending' })
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await StoreKit.purchase({ productId: TRIP_PASS_PRODUCT_ID })

      // Verify with our server and add credits
      const res = await fetch('/api/verify-iap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: result.transactionId,
          productId: result.productId,
          jwsRepresentation: result.jwsRepresentation,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Verification failed')
      }

      // Success — reload to reflect new credits
      window.location.reload()
    } catch (err: any) {
      if (err?.code === 'CANCELLED') {
        // User cancelled — do nothing
      } else {
        setError(err?.message || 'Purchase failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Web Stripe flow ---
  async function handleStripePurchase() {
    if (!isSignedIn) {
      signIn(undefined, { callbackUrl: window.location.href + '?payment=pending' })
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/create-checkout', { method: 'POST' })

      let data: any
      try {
        data = await res.json()
      } catch {
        setError(`Server error (${res.status}). Please try again.`)
        return
      }

      if (data.error === 'sign_in_required') {
        signIn(undefined, { callbackUrl: window.location.href + '?payment=pending' })
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.detail ?? `Checkout failed: ${data.error ?? 'unknown'}`)
      }
    } catch (err) {
      setError(t(locale, 'paywall.error'))
    } finally {
      setLoading(false)
    }
  }

  const displayPrice = native && iapProduct ? iapProduct.displayPrice : '$2.99'
  const handleBuy = native ? handleIAPPurchase : handleStripePurchase

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
            <span className="text-orange font-bold">{displayPrice}</span>
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
          onClick={handleBuy}
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
