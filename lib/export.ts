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

function typeEmoji(type: string): string {
  return type === 'restaurant' ? '🍽️'
    : type === 'attraction' ? '📸'
    : type === 'hotel' ? '🏨'
    : type === 'transport' ? '🚗'
    : '📌'
}

// ---------------------------------------------------------------------------
// 1. Calendar (.ics) export — with LOCATION and GEO
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
      if (place.tips) descParts.push(`Tip: ${place.tips}`)
      if (place.googleRating) descParts.push(`Google: ${place.googleRating}⭐`)
      if (place.priceRange) descParts.push(`Price: ${place.priceRange}`)
      if (place.duration) descParts.push(`Duration: ${place.duration}`)
      if (place.googleMapsUrl) descParts.push(`Maps: ${place.googleMapsUrl}`)

      const uid = `${trip.id}-d${day.dayNumber}-${place.name.replace(/\s+/g, '-').toLowerCase()}@lulgo.com`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTART:${dtStart}`)
      lines.push(`DTEND:${dtEnd}`)
      lines.push(`SUMMARY:${icalEscape(place.nameLocal ? `${place.name} (${place.nameLocal})` : place.name)}`)

      // LOCATION — shows the event on calendar map views
      const location = place.address || (place.nameLocal ? `${place.nameLocal}, ${place.name}` : place.name)
      lines.push(`LOCATION:${icalEscape(location)}`)

      // GEO — lat/lng for map pin in Apple Calendar & others
      if (place.lat != null && place.lng != null) {
        lines.push(`GEO:${place.lat};${place.lng}`)
      }

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
// 2. Clipboard (plain text) export — with duration & price meta
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
      const name = place.nameLocal ? `${place.name}（${place.nameLocal}）` : place.name
      const rating = place.googleRating ? ` ⭐${place.googleRating}` : ''

      lines.push(`${timeStr ? timeStr + ' ' : ''}${typeEmoji(place.type)} ${name}${rating}`)

      // Meta line: duration + price
      const meta: string[] = []
      if (place.duration) meta.push(`⏱ ${place.duration}`)
      if (place.priceRange) meta.push(place.priceRange)
      if (meta.length) lines.push(`   ${meta.join(' · ')}`)

      if (place.description) lines.push(`   ${place.description}`)
      if (place.tips) lines.push(`   💡 ${place.tips}`)
    }

    lines.push('')
  }

  lines.push(`${cn ? '由 Lulgo 生成' : 'Generated by Lulgo'} — lulgo.com`)
  return lines.join('\n')
}

/** Compact share text for messaging apps — one line per day with arrow-separated places */
export function generateShareText(trip: Trip, tripUrl: string): string {
  const cn = isChinese(trip.language)
  const lines: string[] = []

  lines.push(`📍 ${trip.title}`)
  lines.push('')

  for (const day of trip.days) {
    const places = day.places
      .filter(p => p.type !== 'transport')
      .map(p => p.nameLocal || p.name)
    const dayLabel = cn ? `第${day.dayNumber}日` : `Day ${day.dayNumber}`
    lines.push(`${dayLabel}: ${places.join(' → ')}`)
  }

  lines.push('')
  lines.push(`🔗 ${tripUrl}`)
  lines.push(`✨ ${cn ? '用 Lulgo 規劃行程' : 'Plan your trip on Lulgo'} → lulgo.com`)
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
// 3. Image export — card-based design with type-colored accents
// ---------------------------------------------------------------------------

const IMG_TYPE_COLORS: Record<string, string> = {
  attraction: '#60a5fa',
  restaurant: '#fb923c',
  hotel: '#a78bfa',
  transport: '#9ca3af',
  other: '#34d399',
}

const FONT = '-apple-system, BlinkMacSystemFont, "Noto Sans TC", "Noto Sans SC", sans-serif'

export function downloadTripImage(trip: Trip): void {
  const cn = isChinese(trip.language)
  const W = 1080
  const PAD = 56
  const CW = W - PAD * 2             // content width
  const ACCENT_W = 5                  // left accent bar width
  const CARD_PX = 24                  // card horizontal padding
  const CARD_PY = 20                  // card vertical padding
  const CARD_R = 14                   // card border radius
  const TX = PAD + ACCENT_W + CARD_PX + 10  // text x inside card
  const TW = CW - ACCENT_W - CARD_PX * 2 - 10  // text width inside card

  // Places to render (skip transport — it's noise for sharing)
  const renderDays = trip.days.map(day => ({
    ...day,
    places: day.places.filter(p => p.type !== 'transport'),
  }))

  // Helper: compute card height for a place
  function cardHeight(ctx: CanvasRenderingContext2D, p: typeof renderDays[0]['places'][0]): number {
    let h = CARD_PY * 2
    if (p.arrivalTime) h += 28
    const name = p.nameLocal ? `${p.name}（${p.nameLocal}）` : p.name
    ctx.font = `bold 26px ${FONT}`
    h += wrapText(ctx, `${typeEmoji(p.type)} ${name}`, TW).length * 34
    const meta = [
      p.googleRating ? `⭐ ${p.googleRating}` : '',
      p.duration || '',
      p.priceRange || '',
    ].filter(Boolean)
    if (meta.length) h += 28
    if (p.description) {
      ctx.font = `20px ${FONT}`
      h += 8 + wrapText(ctx, p.description, TW).length * 26
    }
    if (p.tips) {
      ctx.font = `20px ${FONT}`
      h += 8 + wrapText(ctx, `💡 ${p.tips}`, TW).length * 26
    }
    return h
  }

  // ── Measure pass ──
  const mc = document.createElement('canvas')
  mc.width = W
  mc.height = 100
  const mx = mc.getContext('2d')
  if (!mx) return

  let totalH = 8 + 48  // top accent + brand area
  mx.font = `bold 44px ${FONT}`
  totalH += wrapText(mx, trip.title, CW).length * 54
  totalH += 50  // subtitle + divider gap

  for (const day of renderDays) {
    totalH += 50 + 20  // day header + gap
    for (let i = 0; i < day.places.length; i++) {
      totalH += cardHeight(mx, day.places[i])
      if (i < day.places.length - 1) totalH += 12  // card gap
    }
    totalH += 30  // day gap
  }
  totalH += 80 + 8  // footer + bottom accent

  const H = Math.max(totalH, 600)

  // ── Render pass ──
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background gradient (deeper navy)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0f172a')
  bg.addColorStop(0.5, '#1e293b')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Top accent bar
  ctx.fillStyle = '#ff6b35'
  ctx.fillRect(0, 0, W, 8)

  let y = 8

  // Brand
  y += 36
  ctx.fillStyle = '#ff6b35'
  ctx.font = `bold 26px ${FONT}`
  ctx.fillText('Lulgo', PAD, y)
  y += 12

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 44px ${FONT}`
  const titleLines = wrapText(ctx, trip.title, CW)
  for (const line of titleLines) {
    y += 54
    ctx.fillText(line, PAD, y)
  }

  // Subtitle
  y += 36
  const totalDays = Math.max(...trip.days.map(d => d.dayNumber))
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `26px ${FONT}`
  ctx.fillText(`${trip.destination} · ${totalDays} ${cn ? '日' : totalDays === 1 ? 'day' : 'days'}`, PAD, y)

  // Divider
  y += 20
  ctx.fillStyle = '#ff6b35'
  ctx.fillRect(PAD, y, 80, 3)
  y += 30

  // ── Days ──
  for (const day of renderDays) {
    // Day header bar
    ctx.fillStyle = 'rgba(255,107,53,0.12)'
    ctx.beginPath()
    ctx.roundRect(PAD, y, CW, 46, 10)
    ctx.fill()

    const dayLabel = cn ? `第${day.dayNumber}日` : `Day ${day.dayNumber}`
    ctx.fillStyle = '#ff6b35'
    ctx.font = `bold 22px ${FONT}`
    const dlw = ctx.measureText(dayLabel).width
    ctx.fillText(dayLabel, PAD + 16, y + 30)

    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = `22px ${FONT}`
    ctx.fillText(day.title, PAD + 16 + dlw + 12, y + 30)

    y += 50 + 20

    // Place cards
    for (let pi = 0; pi < day.places.length; pi++) {
      const p = day.places[pi]
      const tc = IMG_TYPE_COLORS[p.type] || IMG_TYPE_COLORS.other

      // Pre-compute text lines
      const name = p.nameLocal ? `${p.name}（${p.nameLocal}）` : p.name
      ctx.font = `bold 26px ${FONT}`
      const nameLines = wrapText(ctx, `${typeEmoji(p.type)} ${name}`, TW)
      const meta = [
        p.googleRating ? `⭐ ${p.googleRating}` : '',
        p.duration || '',
        p.priceRange || '',
      ].filter(Boolean) as string[]
      ctx.font = `20px ${FONT}`
      const descLines = p.description ? wrapText(ctx, p.description, TW) : []
      const tipLines = p.tips ? wrapText(ctx, `💡 ${p.tips}`, TW) : []

      // Card height
      let ch = CARD_PY * 2
      if (p.arrivalTime) ch += 28
      ch += nameLines.length * 34
      if (meta.length) ch += 28
      if (descLines.length) ch += 8 + descLines.length * 26
      if (tipLines.length) ch += 8 + tipLines.length * 26

      // Card background
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.roundRect(PAD, y, CW, ch, CARD_R)
      ctx.fill()

      // Card subtle border
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(PAD, y, CW, ch, CARD_R)
      ctx.stroke()

      // Left accent bar (clipped to card shape)
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(PAD, y, CW, ch, CARD_R)
      ctx.clip()
      ctx.fillStyle = tc
      ctx.fillRect(PAD, y, ACCENT_W, ch)
      ctx.restore()

      let cy = y + CARD_PY

      // Time
      if (p.arrivalTime) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = `20px ${FONT}`
        ctx.fillText(p.arrivalTime, TX, cy + 16)
        cy += 28
      }

      // Place name
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.font = `bold 26px ${FONT}`
      for (const line of nameLines) {
        ctx.fillText(line, TX, cy + 24)
        cy += 34
      }

      // Meta line (rating · duration · price)
      if (meta.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = `20px ${FONT}`
        ctx.fillText(meta.join('  ·  '), TX, cy + 18)
        cy += 28
      }

      // Description
      if (descLines.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = `20px ${FONT}`
        cy += 8
        for (const line of descLines) {
          ctx.fillText(line, TX, cy + 18)
          cy += 26
        }
      }

      // Tips
      if (tipLines.length) {
        ctx.fillStyle = 'rgba(255,107,53,0.6)'
        ctx.font = `20px ${FONT}`
        cy += 8
        for (const line of tipLines) {
          ctx.fillText(line, TX, cy + 18)
          cy += 26
        }
      }

      y += ch
      if (pi < day.places.length - 1) y += 12
    }

    y += 30
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = `22px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(`${cn ? '由 Lulgo 生成' : 'Generated by Lulgo'} · lulgo.com`, W / 2, H - 40)
  ctx.textAlign = 'left'

  // Bottom accent bar
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

/** Simple text wrapping for canvas — handles CJK characters correctly */
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
// 4. Google Maps route URL (per day)
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
