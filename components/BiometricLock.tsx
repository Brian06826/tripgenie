'use client'

// Lock-screen overlay for native iOS. If the user has enabled "biometric
// unlock" AND is signed in, we render an opaque overlay on app launch and on
// app resume until Face ID / Touch ID succeeds. The overlay also re-locks
// when the app goes to background, so a quick switch back doesn't bypass
// auth and the app-switcher snapshot doesn't leak content.
//
// Failure handling: a single auto-prompt fires when entering the locked
// state. After that, the user has to tap the retry button — this avoids
// fighting the system if biometry is locked out or the user cancelled.
import { useEffect, useState, useCallback, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useSession, signOut } from 'next-auth/react'
import { isNative } from '@/lib/native'
import {
  authenticate,
  isEnabled,
  checkAvailability,
  type AuthFailureReason,
} from '@/lib/native/biometric'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

export function BiometricLock() {
  const { status } = useSession()
  const { locale } = useUILocale()
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(false)
  const [biometryLabel, setBiometryLabel] = useState<'Face ID' | 'Touch ID'>('Face ID')
  const [error, setError] = useState<AuthFailureReason | null>(null)
  const [busy, setBusy] = useState(false)
  // Tracks whether we've already auto-prompted for the current locked
  // session. The user has to manually retry after the first prompt resolves,
  // so we never spam the system dialog.
  const autoPromptedRef = useRef(false)

  // Initial mount: check device capability + decide if we need to lock.
  useEffect(() => {
    if (!isNative()) { setReady(true); return }
    let cancelled = false
    ;(async () => {
      const avail = await checkAvailability()
      if (cancelled) return
      setAvailable(avail.available)
      if (avail.type === 'touchId') setBiometryLabel('Touch ID')
      // Skip lock if user just signed in — they already verified identity
      // via Apple Face ID. The flag is set by the sign-in page.
      try {
        if (sessionStorage.getItem('lulgo.justSignedIn')) {
          sessionStorage.removeItem('lulgo.justSignedIn')
          setReady(true)
          return
        }
      } catch {}
      // Only lock on launch if the user opted in. The session check happens
      // in a separate effect because session may still be loading here.
      if (avail.available && isEnabled()) {
        setLocked(true)
      }
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // If the user is not authenticated, never show the lock — there's nothing
  // protected to lock. Auto-unlock if state changes (e.g. user signs out).
  useEffect(() => {
    if (status === 'unauthenticated') {
      setLocked(false)
      autoPromptedRef.current = false
    }
  }, [status])

  // Re-lock on background, re-prompt on resume.
  useEffect(() => {
    if (!isNative()) return
    let sub: ReturnType<typeof CapApp.addListener> | null = null
    sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isEnabled()) return
      if (!available) return
      if (status !== 'authenticated') return
      if (!isActive) {
        // Background — relock so the snapshot doesn't show app contents.
        autoPromptedRef.current = false
        setError(null)
        setLocked(true)
      } else {
        // Resume — make sure we trigger the prompt on the next tick. The
        // auto-prompt effect below handles the actual call.
        autoPromptedRef.current = false
        setLocked(true)
      }
    })
    return () => {
      sub?.then(s => s.remove()).catch(() => {})
    }
  }, [status, available])

  const tryUnlock = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await authenticate(`Unlock Lulgo with ${biometryLabel}`)
    setBusy(false)
    if (result.ok) {
      setLocked(false)
      autoPromptedRef.current = false
      return
    }
    setError(result.reason)
  }, [busy, biometryLabel])

  // Auto-prompt once whenever we enter the locked state. The ref guard means
  // a failure leaves the overlay visible with the retry button instead of
  // immediately re-prompting in a loop.
  useEffect(() => {
    if (!locked || !ready) return
    if (status !== 'authenticated') return
    if (autoPromptedRef.current) return
    autoPromptedRef.current = true
    tryUnlock()
  }, [locked, ready, status, tryUnlock])

  if (!ready || !locked) return null
  if (status !== 'authenticated') return null

  let errorMessage: string | null = null
  switch (error) {
    case 'cancel': errorMessage = t(locale, 'biometric.error.cancel'); break
    case 'lockout': errorMessage = t(locale, 'biometric.error.lockout'); break
    case 'notEnrolled': errorMessage = t(locale, 'biometric.error.notEnrolled'); break
    case 'unavailable': errorMessage = t(locale, 'biometric.error.unavailable'); break
    case 'passcodeNotSet': errorMessage = t(locale, 'biometric.error.passcodeNotSet'); break
    case 'failed': errorMessage = t(locale, 'biometric.error.failed'); break
    case 'error': errorMessage = t(locale, 'biometric.error.error'); break
    default: errorMessage = null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(locale, 'biometric.lockTitle')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '32px 24px',
      }}
    >
      <div style={{ fontSize: 56 }} aria-hidden="true">🔒</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f1b2d', textAlign: 'center' }}>
        {t(locale, 'biometric.lockTitle')}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280 }}>
        {t(locale, 'biometric.lockSubtitle')}
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginTop: 4,
            fontSize: 12,
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '8px 12px',
            maxWidth: 300,
            textAlign: 'center',
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        onClick={tryUnlock}
        disabled={busy}
        style={{
          marginTop: 8,
          background: busy ? '#fdba74' : '#f97316',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          padding: '12px 28px',
          fontSize: 16,
          fontWeight: 600,
          minWidth: 220,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy
          ? '…'
          : error
            ? t(locale, 'biometric.retry', { method: biometryLabel })
            : t(locale, 'biometric.unlock', { method: biometryLabel })}
      </button>

      <button
        onClick={() => {
          setLocked(false)
          signOut({ redirect: false }).catch(() => {})
        }}
        style={{
          marginTop: 8,
          background: 'transparent',
          color: '#6b7280',
          border: 'none',
          fontSize: 13,
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {t(locale, 'biometric.signOut')}
      </button>
    </div>
  )
}
