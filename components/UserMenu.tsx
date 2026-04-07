'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { locale } = useUILocale()

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
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t(locale, 'user.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
