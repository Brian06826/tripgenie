'use client'

// Native-only banner that asks the user whether they want a one-day-before
// trip reminder, scheduled via @capacitor/local-notifications. Once the user
// either sets or dismisses the reminder, the banner stays hidden for that
// trip ID across launches (state stored in localStorage).
import { useEffect, useState } from 'react'
import { isNative } from '@/lib/native'
import { scheduleTripReminder } from '@/lib/native/notifications'
import { notifySuccess, notifyError } from '@/lib/native/haptics'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

interface Props {
  tripId: string
  tripTitle: string
  destination: string
  startDate?: string
}

const STORAGE_KEY = (id: string) => `lulgo.reminder.${id}`

type Status = 'idle' | 'scheduled' | 'error' | 'past' | 'permission' | 'invalid'

function todayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export function TripReminderPrompt({ tripId, tripTitle, destination, startDate }: Props) {
  const [native, setNative] = useState(false)
  const [hidden, setHidden] = useState(true)
  const [date, setDate] = useState(startDate ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [busy, setBusy] = useState(false)
  const { locale } = useUILocale()

  useEffect(() => {
    if (!isNative()) return
    setNative(true)
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY(tripId))
      if (!seen) setHidden(false)
    } catch {
      setHidden(false)
    }
  }, [tripId])

  if (!native || hidden) return null

  const dismiss = () => {
    try { window.localStorage.setItem(STORAGE_KEY(tripId), 'dismissed') } catch {}
    setHidden(true)
  }

  const handleSet = async () => {
    if (busy) return
    if (!date) {
      setStatus('invalid')
      return
    }
    setBusy(true)
    setStatus('idle')
    // Parse YYYY-MM-DD as a local date (avoid UTC offset shifting it a day).
    const [y, m, d] = date.split('-').map(Number)
    const tripDate = new Date(y, (m ?? 1) - 1, d ?? 1)
    const result = await scheduleTripReminder({
      tripId,
      tripTitle,
      destination,
      tripDate,
    })
    setBusy(false)
    if (result.ok) {
      setStatus('scheduled')
      notifySuccess()
      try { window.localStorage.setItem(STORAGE_KEY(tripId), 'scheduled') } catch {}
      // Auto-dismiss after a short delay so the user sees the confirmation.
      setTimeout(() => setHidden(true), 2200)
    } else {
      notifyError()
      if (result.reason === 'permission') setStatus('permission')
      else if (result.reason === 'past') setStatus('past')
      else if (result.reason === 'invalid') setStatus('invalid')
      else setStatus('error')
    }
  }

  const minDate = todayISO()

  return (
    <div className="mt-4 mb-2 rounded-2xl border border-orange/30 bg-orange/5 p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0" aria-hidden="true">🔔</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {t(locale, 'reminder.title')}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {t(locale, 'reminder.description')}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={e => setDate(e.target.value)}
              className="flex-1 min-w-0 text-base px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange/40"
              aria-label={t(locale, 'reminder.dateLabel')}
            />
          </div>

          {status === 'scheduled' && (
            <p className="text-xs text-emerald-700 mt-2">✅ {t(locale, 'reminder.scheduled')}</p>
          )}
          {status === 'permission' && (
            <p className="text-xs text-red-600 mt-2">{t(locale, 'reminder.permission')}</p>
          )}
          {status === 'past' && (
            <p className="text-xs text-red-600 mt-2">{t(locale, 'reminder.past')}</p>
          )}
          {status === 'invalid' && (
            <p className="text-xs text-red-600 mt-2">{t(locale, 'reminder.invalid')}</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-600 mt-2">{t(locale, 'reminder.error')}</p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSet}
              disabled={busy || status === 'scheduled'}
              className="text-xs font-semibold bg-orange text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {busy ? '…' : t(locale, 'reminder.set')}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t(locale, 'reminder.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
