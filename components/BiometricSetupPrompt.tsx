'use client'

// First-run banner that asks the signed-in user whether to enable Face ID /
// Touch ID for app launch protection. Shown once: after the user either
// accepts or dismisses, we mark "asked" in localStorage and never re-prompt.
// Resets when the user signs out so a fresh sign-in can be re-asked.
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { isNative } from '@/lib/native'
import {
  authenticate,
  checkAvailability,
  hasBeenAsked,
  isEnabled,
  markAsked,
  setEnabled,
} from '@/lib/native/biometric'
import { notifySuccess, notifyError } from '@/lib/native/haptics'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

export function BiometricSetupPrompt() {
  const { status } = useSession()
  const { locale } = useUILocale()
  const [show, setShow] = useState(false)
  const [biometryLabel, setBiometryLabel] = useState<'Face ID' | 'Touch ID'>('Face ID')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isNative()) return
    if (status !== 'authenticated') return
    let cancelled = false
    ;(async () => {
      // Already enabled or already asked → never show.
      if (isEnabled() || hasBeenAsked()) return
      const avail = await checkAvailability()
      if (cancelled) return
      if (!avail.available) {
        // Mark as asked so we don't probe every launch on devices that can't
        // do biometry anyway.
        markAsked()
        return
      }
      if (avail.type === 'touchId') setBiometryLabel('Touch ID')
      setShow(true)
    })()
    return () => { cancelled = true }
  }, [status])

  if (!show) return null

  const handleEnable = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await authenticate(`Enable ${biometryLabel} for Lulgo`)
    setBusy(false)
    if (result.ok) {
      setEnabled(true)
      markAsked()
      notifySuccess()
      setShow(false)
    } else if (result.reason === 'cancel') {
      // Treat cancel as "not now" — keep the banner so they can try again,
      // but don't pollute with an error message.
      setError(null)
    } else {
      notifyError()
      setError(t(locale, 'biometric.setupError'))
    }
  }

  const handleDismiss = () => {
    markAsked()
    setShow(false)
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:left-auto sm:right-4 sm:w-[360px]">
      <div className="rounded-2xl border border-orange/30 bg-white shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0" aria-hidden="true">🔐</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {t(locale, 'biometric.setup.title', { method: biometryLabel })}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {t(locale, 'biometric.setup.description', { method: biometryLabel })}
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-2">{error}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy}
                className="text-xs font-semibold bg-orange text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy ? '…' : t(locale, 'biometric.setup.enable', { method: biometryLabel })}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {t(locale, 'biometric.setup.dismiss')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
