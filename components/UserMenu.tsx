'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'
import { isNative } from '@/lib/native'
import {
  authenticate,
  checkAvailability,
  isEnabled as biometricIsEnabled,
  setEnabled as setBiometricEnabled,
  markAsked,
} from '@/lib/native/biometric'

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { locale } = useUILocale()
  const [bioAvail, setBioAvail] = useState(false)
  const [bioLabel, setBioLabel] = useState<'Face ID' | 'Touch ID'>('Face ID')
  const [bioOn, setBioOn] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)

  // Probe biometric capability when the user is signed in on a native app.
  useEffect(() => {
    if (!isNative()) return
    if (status !== 'authenticated') {
      setBioAvail(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const avail = await checkAvailability()
      if (cancelled) return
      setBioAvail(avail.available)
      if (avail.type === 'touchId') setBioLabel('Touch ID')
      setBioOn(biometricIsEnabled())
    })()
    return () => { cancelled = true }
  }, [status])

  async function toggleBiometric() {
    if (bioBusy) return
    setBioBusy(true)
    if (bioOn) {
      // Disabling: re-auth first so a stranger can't switch it off without
      // the rightful user's biometry.
      const result = await authenticate(`Disable ${bioLabel} for Lulgo`)
      if (result.ok) {
        setBiometricEnabled(false)
        setBioOn(false)
      }
    } else {
      const result = await authenticate(`Enable ${bioLabel} for Lulgo`)
      if (result.ok) {
        setBiometricEnabled(true)
        markAsked()
        setBioOn(true)
      }
    }
    setBioBusy(false)
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      // Sign out and redirect to home
      await signOut({ callbackUrl: '/' })
    } catch {
      alert(t(locale, 'user.deleteFailed'))
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn()}
        className="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 transition-colors"
      >
        {t(locale, 'user.signIn')}
      </button>
    )
  }

  const user = session.user
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full transition-colors hover:ring-2 hover:ring-white/30"
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name ?? 'User'}
            className="w-8 h-8 rounded-full border-2 border-white/30"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-white text-sm font-bold border-2 border-white/30">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          {bioAvail && (
            <button
              onClick={toggleBiometric}
              disabled={bioBusy}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 border-b border-gray-100"
            >
              <span>{t(locale, 'biometric.toggle', { method: bioLabel })}</span>
              <span
                aria-hidden="true"
                className={`relative inline-block w-9 h-5 rounded-full transition-colors ${bioOn ? 'bg-orange' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${bioOn ? 'translate-x-4' : ''}`}
                />
              </span>
            </button>
          )}
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            {t(locale, 'user.signOut')}
          </button>
          <button
            onClick={() => { setOpen(false); setShowDeleteConfirm(true) }}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            {t(locale, 'user.deleteAccount')}
          </button>
        </div>
      )}

      {/* Delete account confirmation modal — portaled to body to avoid clipping */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl mb-safe" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t(locale, 'user.deleteAccount')}</h3>
            <p className="text-sm text-gray-600 mb-5">{t(locale, 'user.deleteConfirm')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {t(locale, 'edit.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? t(locale, 'user.deleting') : t(locale, 'user.deleteAccount')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
