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

/** Get the date for a specific day number, given trip startDate. Falls back to today.
 *  Parses YYYY-MM-DD as LOCAL date to avoid timezone shift
 *  (new Date("2026-04-15") = UTC midnight → getDate() returns 14 west of UTC). */
function getDayDate(startDate: string | undefined, dayNumber: number): Date {
  let base: Date
  if (startDate) {
    const [y, m, d] = startDate.split('-').map(Number)
    if (y && m && d) {
      base = new Date(y, m - 1, d) // local midnight
    } else {
      base = new Date()
    }
  } else {
    base = new Date()
  }
  base.setDate(base.getDate() + dayNumber - 1)
  return base
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

/** Format a date for display in image day headers */
function formatDayDate(date: Date, cn: boolean): string {
  const dow = cn
    ? ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
  if (cn) return `${date.getMonth() + 1}月${date.getDate()}日（${dow}）`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()} (${dow})`
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

      const location = place.address || (place.nameLocal ? `${place.nameLocal}, ${place.name}` : place.name)
      lines.push(`LOCATION:${icalEscape(location)}`)

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

/** Compact share text for messaging apps */
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
// 3. Image export — card-based design with type-colored tints
// ---------------------------------------------------------------------------

const FONT = '-apple-system, BlinkMacSystemFont, "Noto Sans TC", "Noto Sans SC", sans-serif'

const IMG_ACCENT: Record<string, string> = {
  attraction: '#60a5fa',
  restaurant: '#fb923c',
  hotel: '#a78bfa',
  transport: '#9ca3af',
  other: '#34d399',
}

// Type-specific card backgrounds — subtle tints that distinguish each type
const CARD_BG: Record<string, string> = {
  attraction: 'rgba(96, 165, 250, 0.07)',
  restaurant: 'rgba(251, 146, 60, 0.08)',
  hotel: 'rgba(167, 139, 250, 0.07)',
  transport: 'rgba(156, 163, 175, 0.05)',
  other: 'rgba(52, 211, 153, 0.06)',
}

const CARD_BORDER: Record<string, string> = {
  attraction: 'rgba(96, 165, 250, 0.15)',
  restaurant: 'rgba(251, 146, 60, 0.15)',
  hotel: 'rgba(167, 139, 250, 0.15)',
  transport: 'rgba(156, 163, 175, 0.10)',
  other: 'rgba(52, 211, 153, 0.12)',
}

export async function downloadTripImage(trip: Trip): Promise<void> {
  const cn = isChinese(trip.language)
  const W = 1080
  const PAD = 56
  const CW = W - PAD * 2
  const ACCENT_W = 5
  const CARD_PX = 24
  const CARD_PY = 20
  const CARD_R = 14
  const TX = PAD + ACCENT_W + CARD_PX + 10
  const TW = CW - ACCENT_W - CARD_PX * 2 - 10

  // Skip transport places (noise for social sharing)
  const renderDays = trip.days.map(day => ({
    ...day,
    places: day.places.filter(p => p.type !== 'transport'),
  }))

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

  let totalH = 56  // accent(8) + brand baseline(36) + gap(12)
  mx.font = `bold 44px ${FONT}`
  totalH += wrapText(mx, trip.title, CW).length * 54
  totalH += 89  // subtitle(36) + to-divider(20) + divider(3) + after-divider(30)

  for (const day of renderDays) {
    totalH += 70  // header(46+4) + gap(20)
    for (let i = 0; i < day.places.length; i++) {
      totalH += cardHeight(mx, day.places[i])
      if (i < day.places.length - 1) totalH += 12
    }
    totalH += 30
  }
  totalH += 88  // footer space (gap + text + accent)

  const H = Math.max(totalH, 600)

  // ── Render pass ──
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background gradient (deep navy)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0f172a')
  bg.addColorStop(0.4, '#162033')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Subtle dot pattern for texture
  ctx.fillStyle = 'rgba(255,255,255,0.015)'
  for (let dx = 0; dx < W; dx += 40) {
    for (let dy = 0; dy < H; dy += 40) {
      ctx.beginPath()
      ctx.arc(dx, dy, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

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
  y += 3
  y += 30

  // ── Days ──
  for (const day of renderDays) {
    // Day header bar
    ctx.fillStyle = 'rgba(255,107,53,0.12)'
    ctx.beginPath()
    ctx.roundRect(PAD, y, CW, 46, 10)
    ctx.fill()

    // Day label with optional date
    const dayLabel = cn ? `第${day.dayNumber}日` : `Day ${day.dayNumber}`
    const dateStr = trip.startDate
      ? ` · ${formatDayDate(getDayDate(trip.startDate, day.dayNumber), cn)}`
      : ''
    const fullDayLabel = dayLabel + dateStr

    ctx.fillStyle = '#ff6b35'
    ctx.font = `bold 22px ${FONT}`
    const dlw = ctx.measureText(fullDayLabel).width
    ctx.fillText(fullDayLabel, PAD + 16, y + 30)

    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = `22px ${FONT}`
    ctx.fillText(day.title, PAD + 16 + dlw + 12, y + 30)

    y += 70 // 46 header + 4 spacing + 20 gap

    // Place cards
    for (let pi = 0; pi < day.places.length; pi++) {
      const p = day.places[pi]
      const pType = p.type || 'other'
      const accentColor = IMG_ACCENT[pType] || IMG_ACCENT.other
      const cardBg = CARD_BG[pType] || CARD_BG.other
      const cardBorder = CARD_BORDER[pType] || CARD_BORDER.other

      // Pre-compute text
      const name = p.nameLocal ? `${p.name}（${p.nameLocal}）` : p.name
      ctx.font = `bold 26px ${FONT}`
      const nameLines = wrapText(ctx, `${typeEmoji(pType)} ${name}`, TW)
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

      // Card background — type-specific tint
      ctx.fillStyle = cardBg
      ctx.beginPath()
      ctx.roundRect(PAD, y, CW, ch, CARD_R)
      ctx.fill()

      // Card border — type-specific
      ctx.strokeStyle = cardBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(PAD, y, CW, ch, CARD_R)
      ctx.stroke()

      // Left accent bar (clipped to card roundness)
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(PAD, y, CW, ch, CARD_R)
      ctx.clip()
      ctx.fillStyle = accentColor
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

  // ── Download / Share (iOS-aware) ──
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png')
  )
  if (!blob) return

  const fileName = `${trip.destination.replace(/\s+/g, '-')}-itinerary.png`

  // Try Web Share API with file (iOS 15+, Android Chrome)
  if (navigator.share) {
    try {
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // Fall through to other methods
    }
  }

  // iOS fallback: open in new tab for long-press save
  // (<a download> doesn't work on iOS Safari)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    const dataUrl = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(
        `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>${trip.title}</title></head>` +
        `<body style="margin:0;display:flex;justify-content:center;background:#111">` +
        `<img src="${dataUrl}" style="max-width:100%;height:auto">` +
        `</body></html>`
      )
      w.document.close()
    }
    return
  }

  // Desktop: standard <a download>
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  const waypoints: string[] = []

  for (const place of day.places) {
    if (place.type === 'transport') continue
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

  const origin = encodeURIComponent(waypoints[0])
  const destination = encodeURIComponent(waypoints[waypoints.length - 1])
  const middle = waypoints.slice(1, -1).map(w => encodeURIComponent(w)).join('|')

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit`
  if (middle) {
    url += `&waypoints=${middle}`
  }
  return url
}
