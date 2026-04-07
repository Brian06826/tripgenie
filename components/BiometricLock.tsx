'use client'

// Lock-screen overlay for native iOS. If the user has enabled "biometric
// unlock", we render an opaque overlay on app launch (and on app resume)
// until Face ID / Touch ID succeeds. The overlay also re-locks when the
// app goes to background, so a quick switch back doesn't bypass auth.
import { useEffect, useState, useCallback } from 'react'
import { App as CapApp } from '@capacitor/app'
import { isNative } from '@/lib/native'
import { authenticate, isEnabled, checkAvailability } from '@/lib/native/biometric'

export function BiometricLock() {
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [biometryLabel, setBiometryLabel] = useState<'Face ID' | 'Touch ID'>('Face ID')

  // Initial mount: decide whether to show lock
  useEffect(() => {
    if (!isNative()) { setReady(true); return }
    let cancelled = false
    ;(async () => {
      const avail = await checkAvailability()
      if (cancelled) return
      if (avail.type === 'touchId') setBiometryLabel('Touch ID')
      if (avail.available && isEnabled()) setLocked(true)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Re-lock on background, prompt on resume
  useEffect(() => {
    if (!isNative()) return
    let removed = false
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isEnabled()) return
      if (!isActive) {
        // Going to background — relock immediately so the screenshot in the
        // app switcher doesn't show app contents.
        setLocked(true)
      }
    })
    return () => {
      if (removed) return
      removed = true
      sub.then(s => s.remove()).catch(() => {})
    }
  }, [])

  const tryUnlock = useCallback(async () => {
    const ok = await authenticate(`Unlock Lulgo with ${biometryLabel}`)
    if (ok) setLocked(false)
  }, [biometryLabel])

  // Auto-prompt when entering locked state
  useEffect(() => {
    if (locked && ready) tryUnlock()
  }, [locked, ready, tryUnlock])

  if (!ready || !locked) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#0f1b2d' }}>Lulgo is locked</div>
      <button
        onClick={tryUnlock}
        style={{
          marginTop: 12,
          background: '#f97316',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          padding: '12px 24px',
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        Unlock with {biometryLabel}
      </button>
    </div>
  )
}
