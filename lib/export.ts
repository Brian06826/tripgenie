import type { Trip, DayPlan, Place } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isChinese(lang?: string): boolean {
  return lang === 'zh-TW' || lang === 'zh-HK' || lang === 'zh-CN'
}

/** Parse "9:00 AM" → { hours: 9, minutes: 0 }. Returns null if unparseable. */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

/** Parse "1-2 hours" → 90, "30 min" → 30, "2 hours" → 120 */
function parseDurationMinutes(dur: string): number {
  const rangeMatch = dur.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*hour/i)
  if (rangeMatch) return Math.round((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2 * 60)
  const hourMatch = dur.match(/(\d+\.?\d*)\s*hour/i)
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60)
  const minMatch = dur.match(/(\d+)\s*min/i)
  if (minMatch) return parseInt(minMatch[1])
  return 60
}

/** Get the date for a specific day number, given trip startDate. Falls back to today. */
function getDayDate(startDate: string | undefined, dayNumber: number): Date {
  const base = startDate ? new Date(startDate) : new Date()
  // If invalid date, use today
  if (isNaN(base.getTime())) {
    const now = new Date()
    now.setDate(now.getDate() + dayNumber - 1)
    return now
  }
  const result = new Date(base)
  result.setDate(result.getDate() + dayNumber - 1)
  return result
}

/** Format date as YYYYMMDD for iCal */
function icalDate(d: Date, hours: number, minutes: number): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(hours).padStart(2, '0')
  const min = String(minutes).padStart(2, '0')
  return `${y}${m}${day}T${h}${min}00`
}

/** Escape special characters for iCal text fields */
function icalEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// ---------------------------------------------------------------------------
// 1. Calendar (.ics) export
// ---------------------------------------------------------------------------

export function generateICS(trip: Trip): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lulgo//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icalEscape(trip.title)}`,
  ]

  for (const day of trip.days) {
    const dayDate = getDayDate(trip.startDate, day.dayNumber)

    for (const place of day.places) {
      if (!place.arrivalTime) continue

      const time = parseTime(place.arrivalTime)
      if (!time) continue

      const durationMin = place.duration ? parseDurationMinutes(place.duration) : 60
      const endHours = Math.floor((time.hours * 60 + time.minutes + durationMin) / 60) % 24
      const endMinutes = (time.hours * 60 + time.minutes + durationMin) % 60

      const dtStart = icalDate(dayDate, time.hours, time.minutes)
      const dtEnd = icalDate(dayDate, endHours, endMinutes)

      const descParts: string[] = []
      if (place.description) descParts.push(place.description)
      if (place.tips) descParts.push(place.tips)
      if (place.googleRating) descParts.push(`Google: ${place.googleRating}⭐`)
      if (place.priceRange) descParts.push(`Price: ${place.priceRange}`)
      if (place.googleMapsUrl) descParts.push(`Maps: ${place.googleMapsUrl}`)

      const uid = `${trip.id}-d${day.dayNumber}-${place.name.replace(/\s+/g, '-').toLowerCase()}@lulgo.com`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTART:${dtStart}`)
      lines.push(`DTEND:${dtEnd}`)
      lines.push(`SUMMARY:${icalEscape(place.nameLocal ? `${place.name} (${place.nameLocal})` : place.name)}`)
      if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${icalEscape(descParts.join('\\n'))}`)
      }
      if (place.googleMapsUrl) {
        lines.push(`URL:${place.googleMapsUrl}`)
      }
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(trip: Trip): void {
  const ics = generateICS(trip)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.destination.replace(/\s+/g, '-')}-itinerary.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// 2. Clipboard (plain text) export
// ---------------------------------------------------------------------------

export function generatePlainText(trip: Trip): string {
  const cn = isChinese(trip.language)
  const lines: string[] = []

  lines.push(`📍 ${trip.title}`)
  lines.push(`${trip.destination}`)
  lines.push('')

  for (const day of trip.days) {
    lines.push(`━━━ ${cn ? '第' : 'Day '}${day.dayNumber}${cn ? '日' : ''}: ${day.title} ━━━`)

    for (const place of day.places) {
      const timeStr = place.arrivalTime ?? ''
      const typeEmoji = place.type === 'restaurant' ? '🍽️'
        : place.type === 'attraction' ? '📸'
        : place.type === 'hotel' ? '🏨'
        : place.type === 'transport' ? '🚗'
        : '📌'

      const name = place.nameLocal ? `${place.name}（${place.nameLocal}）` : place.name
      const rating = place.googleRating ? ` ⭐${place.googleRating}` : ''

      lines.push(`${timeStr ? timeStr + ' ' : ''}${typeEmoji} ${name}${rating}`)
      if (place.description) lines.push(`   ${place.description}`)
      if (place.tips) lines.push(`   💡 ${place.tips}`)
    }

    lines.push('')
  }

  lines.push(`${cn ? '由 Lulgo 生成' : 'Generated by Lulgo'} — lulgo.com`)
  return lines.join('\n')
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Google Maps route URL (per day)
// ---------------------------------------------------------------------------

export function buildGoogleMapsRouteUrl(day: DayPlan): string {
  // Use lat/lng if available, otherwise use place names
  const waypoints: string[] = []

  for (const place of day.places) {
    if (place.type === 'transport') continue // Skip transport stops
    if (place.lat != null && place.lng != null) {
      waypoints.push(`${place.lat},${place.lng}`)
    } else {
      waypoints.push(place.name)
    }
  }

  if (waypoints.length === 0) return ''
  if (waypoints.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(waypoints[0])}`
  }

  // Google Maps directions: origin → waypoints → destination
  const origin = encodeURIComponent(waypoints[0])
  const destination = encodeURIComponent(waypoints[waypoints.length - 1])
  const middle = waypoints.slice(1, -1).map(w => encodeURIComponent(w)).join('|')

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit`
  if (middle) {
    url += `&waypoints=${middle}`
  }
  return url
}
