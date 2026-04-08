// Local notification helpers (no Firebase / no remote push).
//
// Used to schedule a one-shot reminder the day before a trip starts. The
// plugin handles permission prompting; on web every call is a no-op.
import { isNative } from './index'

/** Stable positive 31-bit integer derived from a trip ID for the notification. */
function tripIdToNotificationId(tripId: string): number {
  let h = 0
  for (let i = 0; i < tripId.length; i++) {
    h = (h * 31 + tripId.charCodeAt(i)) | 0
  }
  // Ensure positive 31-bit value.
  return Math.abs(h) % 2147483647 || 1
}

/** Compute the reminder fire time: 9 AM local on the day before tripDate. */
function computeReminderAt(tripDate: Date): Date {
  const at = new Date(tripDate)
  at.setDate(at.getDate() - 1)
  at.setHours(9, 0, 0, 0)
  return at
}

export type ScheduleResult =
  | { ok: true; reminderAt: Date }
  | { ok: false; reason: 'web' | 'permission' | 'past' | 'invalid' | 'error' }

/**
 * Schedule a local notification one day before tripDate at 9 AM. Cancels any
 * existing reminder for the same tripId before scheduling a new one.
 */
export async function scheduleTripReminder(opts: {
  tripId: string
  tripTitle: string
  destination: string
  tripDate: Date
  body?: string
}): Promise<ScheduleResult> {
  if (!isNative()) return { ok: false, reason: 'web' }
  if (isNaN(opts.tripDate.getTime())) return { ok: false, reason: 'invalid' }

  const reminderAt = computeReminderAt(opts.tripDate)
  if (reminderAt.getTime() <= Date.now()) return { ok: false, reason: 'past' }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return { ok: false, reason: 'permission' }

    const id = tripIdToNotificationId(opts.tripId)

    // Best-effort cancel of any prior reminder for this trip so re-scheduling
    // (e.g. after the user changes the start date) doesn't double-fire.
    try { await LocalNotifications.cancel({ notifications: [{ id }] }) } catch {}

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: opts.tripTitle,
          body: opts.body ?? `Your trip to ${opts.destination} starts tomorrow ✈️`,
          schedule: { at: reminderAt, allowWhileIdle: true },
          extra: { tripId: opts.tripId },
        },
      ],
    })
    return { ok: true, reminderAt }
  } catch (e) {
    console.warn('[notifications] schedule failed:', e)
    return { ok: false, reason: 'error' }
  }
}

/** Cancel a previously scheduled trip reminder. */
export async function cancelTripReminder(tripId: string): Promise<void> {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const id = tripIdToNotificationId(tripId)
    await LocalNotifications.cancel({ notifications: [{ id }] })
  } catch {}
}
