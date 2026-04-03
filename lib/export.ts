import type { Trip, DayPlan } from './types'

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

// ---------------------------------------------------------------------------
// 4. PDF export (browser print)
// ---------------------------------------------------------------------------

export function openPrintView(trip: Trip): void {
  const cn = isChinese(trip.language)
  const totalDays = Math.max(...trip.days.map(d => d.dayNumber))

  const typeEmoji = (type: string) =>
    type === 'restaurant' ? '🍽️'
    : type === 'attraction' ? '📸'
    : type === 'hotel' ? '🏨'
    : type === 'transport' ? '🚗'
    : '📌'

  const daysHtml = trip.days.map(day => `
    <div class="day-section">
      <div class="day-header">
        <span class="day-number">${cn ? `第${day.dayNumber}日` : `Day ${day.dayNumber}`}</span>
        <span class="day-title">${day.title}</span>
      </div>
      ${day.places.map(place => `
        <div class="place-row">
          <div class="place-time">${place.arrivalTime ?? ''}</div>
          <div class="place-content">
            <div class="place-name">
              ${typeEmoji(place.type)} ${place.nameLocal ? `${place.name}（${place.nameLocal}）` : place.name}
              ${place.googleRating ? `<span class="rating">⭐${place.googleRating}</span>` : ''}
              ${place.priceRange ? `<span class="price">${place.priceRange}</span>` : ''}
            </div>
            ${place.description ? `<div class="place-desc">${place.description}</div>` : ''}
            ${place.tips ? `<div class="place-tips">💡 ${place.tips}</div>` : ''}
            ${place.duration ? `<div class="place-duration">⏱ ${place.duration}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('')

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${trip.title}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Noto Sans SC", sans-serif; color: #1a1a2e; font-size: 11pt; line-height: 1.5; }
  .header { background: #1a1a2e; color: white; padding: 24px 28px; margin: -20mm -15mm 0; }
  .brand { color: #ff6b35; font-size: 10pt; font-weight: 700; margin-bottom: 4px; }
  .title { font-size: 20pt; font-weight: 700; margin-bottom: 4px; }
  .subtitle { opacity: 0.8; font-size: 10pt; }
  .day-section { margin-top: 20px; page-break-inside: avoid; }
  .day-header { background: #f8f8fc; border-left: 4px solid #ff6b35; padding: 8px 14px; margin-bottom: 10px; }
  .day-number { font-weight: 700; color: #ff6b35; margin-right: 8px; }
  .day-title { font-weight: 600; color: #1a1a2e; }
  .place-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
  .place-time { width: 70px; flex-shrink: 0; font-size: 9pt; color: #888; font-weight: 500; padding-top: 2px; }
  .place-content { flex: 1; }
  .place-name { font-weight: 600; font-size: 10.5pt; }
  .rating { color: #ff6b35; font-weight: 400; font-size: 9pt; margin-left: 4px; }
  .price { color: #888; font-size: 9pt; margin-left: 4px; }
  .place-desc { font-size: 9pt; color: #555; margin-top: 2px; }
  .place-tips { font-size: 9pt; color: #ff6b35; margin-top: 2px; }
  .place-duration { font-size: 8.5pt; color: #aaa; margin-top: 2px; }
  .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #ccc; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { .no-print { display: none; } }
</style>
</head><body>
  <div class="header">
    <div class="brand">Lulgo</div>
    <div class="title">${trip.title}</div>
    <div class="subtitle">${trip.destination} · ${totalDays} ${cn ? '日' : totalDays === 1 ? 'day' : 'days'}</div>
  </div>
  ${daysHtml}
  <div class="footer">${cn ? '由 Lulgo 生成' : 'Generated by Lulgo'} — lulgo.com</div>
  <script>window.onload=()=>{window.print()}</script>
</body></html>`

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  }
}

// ---------------------------------------------------------------------------
// 5. Image export (IG Story 1080x1920)
// ---------------------------------------------------------------------------

export function downloadTripImage(trip: Trip): void {
  const cn = isChinese(trip.language)
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = 1080
  const H = 1920

  // Background gradient (navy)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a1a2e')
  bg.addColorStop(1, '#16213e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Orange accent bar at top
  ctx.fillStyle = '#ff6b35'
  ctx.fillRect(0, 0, W, 8)

  // Brand
  ctx.fillStyle = '#ff6b35'
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.fillText('Lulgo', 60, 80)

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, sans-serif'
  const titleLines = wrapText(ctx, trip.title, W - 120)
  let y = 140
  for (const line of titleLines) {
    ctx.fillText(line, 60, y)
    y += 62
  }

  // Subtitle
  const totalDays = Math.max(...trip.days.map(d => d.dayNumber))
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.fillText(`${trip.destination} · ${totalDays} ${cn ? '日' : totalDays === 1 ? 'day' : 'days'}`, 60, y + 10)
  y += 60

  // Divider
  ctx.fillStyle = '#ff6b35'
  ctx.fillRect(60, y, 120, 4)
  y += 40

  // Day content
  for (const day of trip.days) {
    if (y > H - 200) break

    // Day header
    ctx.fillStyle = '#ff6b35'
    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(`${cn ? `第${day.dayNumber}日` : `Day ${day.dayNumber}`}  ${day.title}`, 60, y)
    y += 42

    for (const place of day.places) {
      if (y > H - 200) break

      const typeEmoji = place.type === 'restaurant' ? '🍽️'
        : place.type === 'attraction' ? '📸'
        : place.type === 'hotel' ? '🏨'
        : place.type === 'transport' ? '🚗'
        : '📌'

      const name = place.nameLocal ? `${place.name}（${place.nameLocal}）` : place.name
      const timeStr = place.arrivalTime ? `${place.arrivalTime}  ` : ''

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif'
      const placeText = `${timeStr}${typeEmoji} ${name}`
      const placeLines = wrapText(ctx, placeText, W - 140)
      for (const line of placeLines) {
        ctx.fillText(line, 80, y)
        y += 32
      }
      y += 8
    }

    y += 20
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${cn ? '由 Lulgo 生成' : 'Generated by Lulgo'} — lulgo.com`, W / 2, H - 50)
  ctx.textAlign = 'left'

  // Orange accent bar at bottom
  ctx.fillStyle = '#ff6b35'
  ctx.fillRect(0, H - 8, W, 8)

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.destination.replace(/\s+/g, '-')}-itinerary.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

/** Simple text wrapping for canvas */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = [...text]
  const lines: string[] = []
  let current = ''
  for (const char of chars) {
    const test = current + char
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

// ---------------------------------------------------------------------------
// 6. Google Maps route URL (per day)
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
