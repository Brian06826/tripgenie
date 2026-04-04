import Anthropic from '@anthropic-ai/sdk'
import type { TripGeneration } from './types'
import { TripGenerationSchema } from './types'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured.')
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000 })
  }
  return _client
}

const EDIT_TRIP_SYSTEM_PROMPT = `You are Lulgo's trip editor. You receive an existing trip itinerary as JSON and the user's edit instruction. Modify the trip according to the instruction and return the COMPLETE updated trip JSON.

Respond ONLY with valid JSON — no markdown, no explanation, no text outside the JSON object.

CRITICAL TIMING RULES (NEVER VIOLATE — CHECK EVERY TIME BEFORE RETURNING):
- ABSOLUTE HARD LIMIT: NO activity after 9:30 PM. Period. No exceptions.
- Breakfast: 7:30 AM - 9:00 AM
- Morning activities: 9:00 AM - 12:00 PM
- Lunch: 11:30 AM - 1:30 PM. NEVER after 2:00 PM.
- Afternoon activities: 1:00 PM - 5:30 PM
- Dinner: 6:00 PM - 8:00 PM ONLY. NEVER at 8:30 PM, 9:00 PM, 9:45 PM, or any time after 8:00 PM. If dinner is currently at 6:30 PM, keep it at 6:30 PM.
- Evening activities (bars, nightlife): 8:00 PM - 9:30 PM maximum.
- Parks, museums, temples, nature spots: ONLY between 8:00 AM and 5:30 PM. NEVER at night.
- Hotels/check-in: after the last activity of the day (typically after dinner, around 8:30-9:30 PM). Place it as the ABSOLUTE LAST stop of the day.

EDITING RULES:
- When the user asks to change ONE place (e.g. "change dinner to Japanese"), ONLY replace that ONE place:
  * Copy the EXACT arrivalTime from the original place to the replacement. If dinner was at "6:30 PM", the new restaurant MUST also be at "6:30 PM".
  * Copy the EXACT duration from the original place. If it was "1-1.5 hours", keep "1-1.5 hours".
  * Do NOT touch ANY other place in the entire trip. Every other place keeps its exact name, arrivalTime, duration, description, tips, ratings.
  * Only change: name, nameLocal, description, googleRating, yelpRating, tips, priceRange, backupOptions.
- Return the COMPLETE trip JSON with all days and all places, not just the changed parts.
- If the user says "add a coffee shop after lunch", insert a new cafe/dessert stop after the lunch place with an appropriate time (e.g. 2:00 PM, 30-45 min duration).
- If the user says "remove X", remove that stop and adjust the remaining schedule times to fill the gap naturally.
- If the user says "swap day 1 and day 2", swap the entire day contents but keep dayNumber sequential (1, 2, 3...).
- If the user says "make it more relaxed", remove 1 stop per day and extend durations.
- If the user says "add nightlife", add an evening bar/club/live music venue after dinner (max 9:30 PM).
- When adding new places, they MUST be real, well-known establishments you are confident exist.
- Maintain geographic constraints: all places must be in the trip's destination city or immediate vicinity.
- No duplicate places across the entire trip.
- Match the language of the existing trip for all new text (titles, descriptions, tips).
- Keep the same "title" and "destination" unless the edit specifically changes them.
- When removing a place, adjust subsequent arrivalTimes to be natural (no 3-hour gaps between stops).
- CRITICAL: Copy the EXACT arrivalTime from the original place to the replacement. Do not change it.
- FINAL CHECK: If ANY arrivalTime is after 9:30 PM, it is WRONG. Fix it to be earlier. Dinner MUST be between 6:00 PM and 8:00 PM. A dinner at 9:45 PM or 10:40 PM is NEVER acceptable.

JSON schema (return exactly this structure):
{
  "title": "string",
  "destination": "string",
  "language": "en|zh-TW|zh-HK|zh-CN",
  "days": [{
    "dayNumber": 1,
    "title": "string",
    "places": [{
      "name": "string",
      "nameLocal": "string (optional, local script)",
      "type": "attraction|restaurant|hotel|transport|other",
      "description": "string (1 sentence)",
      "arrivalTime": "string (e.g. '9:00 AM')",
      "duration": "string (e.g. '1-2 hours')",
      "googleRating": number (optional, 1.0-5.0),
      "googleReviewCount": number (optional),
      "yelpRating": number (optional, US only),
      "yelpReviewCount": number (optional),
      "tips": "string (optional, 1 sentence)",
      "priceRange": "$|$$|$$$|$$$$ (restaurants only, optional)",
      "backupOptions": [{ "name": "string", "nameLocal": "string (optional)", "description": "string", "googleRating": number (optional) }]
    }]
  }]
}`

function cleanJsonText(raw: string): string {
  return raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function parseJsonResponse(text: string): unknown {
  const clean = cleanJsonText(text)
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(clean.slice(start, end + 1))
    }
    throw new Error('Failed to parse edit response as JSON')
  }
}

/** Parse "9:30 PM" to minutes since midnight (e.g. 21*60+30=1290). Returns null if unparseable. */
function parseTime(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/** Clamp any arrivalTime after 9:30 PM to a sane value, and fix night markets before 5 PM. Mutates in place. */
export function clampLateTimes(trip: TripGeneration): void {
  const LIMIT = 21 * 60 + 30 // 9:30 PM
  const NIGHT_MARKET_EARLIEST = 17 * 60 // 5:00 PM
  for (const day of trip.days) {
    for (const place of day.places) {
      if (!place.arrivalTime) continue
      const mins = parseTime(place.arrivalTime)
      if (mins === null) continue

      // Night market scheduled before 5 PM → move to 5:00 PM
      const nameStr = `${place.name} ${(place as any).nameLocal || ''} ${place.description || ''}`
      const isNightMarket = /night\s*market|夜市/i.test(nameStr)
      if (isNightMarket && mins < NIGHT_MARKET_EARLIEST) {
        place.arrivalTime = '5:00 PM'
        console.log(`[clamp] Fixed early night market "${place.name}": was ${mins} mins → 5:00 PM`)
        continue
      }

      if (mins > LIMIT) {
        // Restaurants (dinner) → 7:00 PM, hotels → 9:00 PM, everything else → 5:00 PM
        if (place.type === 'restaurant') {
          place.arrivalTime = '7:00 PM'
        } else if (place.type === 'hotel') {
          place.arrivalTime = '9:00 PM'
        } else {
          place.arrivalTime = '5:00 PM'
        }
        console.log(`[edit-trip] Clamped late time for "${place.name}": was ${mins} mins → ${place.arrivalTime}`)
      }
    }
  }
}

/** Detect which day numbers the instruction targets. Returns null if whole-trip edit. */
function detectTargetDays(instruction: string, totalDays: number): number[] | null {
  const lower = instruction.toLowerCase()

  // Whole-trip keywords — send everything
  if (/swap day|reorder|rearrange|all days|every day|整個|所有|每日|每天|交換|調換/.test(lower)) return null
  if (/more relaxed|more packed|縮短|延長所有/.test(lower)) return null

  // Detect specific day references: "day 3", "第3日", "day3", "第三天" etc
  const dayRefs = new Set<number>()
  const patterns = [
    /day\s*(\d+)/gi,
    /第\s*(\d+)\s*[日天]/g,
    /第\s*([一二三四五六七八九十]+)\s*[日天]/g,
  ]
  const cnDigits: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }

  for (const pat of patterns) {
    let m
    while ((m = pat.exec(lower)) !== null) {
      const val = cnDigits[m[1]] ?? parseInt(m[1], 10)
      if (val >= 1 && val <= totalDays) dayRefs.add(val)
    }
  }

  if (dayRefs.size > 0) return [...dayRefs].sort((a, b) => a - b)

  // Meal/time-of-day hints without day number — ambiguous, send all
  // Simple edits like "change dinner to X" without day ref — send all (Claude needs context)
  return null
}

/** Merge edited days back into the full trip generation. */
function mergeDays(
  original: TripGeneration,
  editedDays: TripGeneration['days'],
  targetDayNumbers: number[],
): TripGeneration {
  const dayMap = new Map<number, TripGeneration['days'][0]>()
  for (const day of editedDays) dayMap.set(day.dayNumber, day)

  return {
    ...original,
    title: original.title,
    destination: original.destination,
    language: original.language,
    days: original.days.map(day => dayMap.get(day.dayNumber) ?? day),
  }
}

export async function editTrip(
  currentTrip: TripGeneration,
  instruction: string,
  language: string,
): Promise<TripGeneration> {
  const totalDays = currentTrip.days.length
  const targetDays = detectTargetDays(instruction, totalDays)
  const isPartial = targetDays !== null && targetDays.length < totalDays

  // Only send targeted days to reduce tokens
  const tripToSend = isPartial
    ? { ...currentTrip, days: currentTrip.days.filter(d => targetDays.includes(d.dayNumber)) }
    : currentTrip

  const partialNote = isPartial
    ? `\nNOTE: You are only editing day${targetDays.length > 1 ? 's' : ''} ${targetDays.join(', ')} of a ${totalDays}-day trip. Return ONLY the modified day${targetDays.length > 1 ? 's' : ''} in the days array.`
    : ''

  const userMessage = `CURRENT TRIP:
${JSON.stringify(tripToSend, null, 2)}
${partialNote}
EDIT INSTRUCTION: ${instruction}
LANGUAGE: ${language}

Return the ${isPartial ? 'modified days' : 'complete updated trip'} JSON with modifications applied.`

  const maxTokens = isPartial ? Math.max(4000, targetDays.length * 3000) : 14000

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    system: EDIT_TRIP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const parsed = parseJsonResponse(content.text)
  const result = TripGenerationSchema.safeParse(parsed)
  if (result.success) {
    clampLateTimes(result.data)
    if (isPartial) return mergeDays(currentTrip, result.data.days, targetDays)
    return result.data
  }

  // If partial edit returned only days, try wrapping in full structure
  if (isPartial && Array.isArray(parsed)) {
    const wrapped = { ...currentTrip, days: parsed }
    const wrappedResult = TripGenerationSchema.safeParse(wrapped)
    if (wrappedResult.success) {
      clampLateTimes(wrappedResult.data)
      return mergeDays(currentTrip, wrappedResult.data.days, targetDays)
    }
  }

  // One retry with validation errors
  const retryMessage = `Previous response had validation errors: ${JSON.stringify(
    result.error.issues.map(e => ({ path: e.path.join('.'), message: e.message }))
  )}

Fix the errors and return ONLY valid JSON matching the schema.

CURRENT TRIP:
${JSON.stringify(tripToSend, null, 2)}
${partialNote}
EDIT INSTRUCTION: ${instruction}`

  const retryResponse = await getClient().messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    system: EDIT_TRIP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: retryMessage }],
  })

  const retryContent = retryResponse.content[0]
  if (retryContent.type !== 'text') throw new Error('Unexpected retry response type')

  const retryParsed = parseJsonResponse(retryContent.text)
  const retryResult = TripGenerationSchema.safeParse(retryParsed)
  if (retryResult.success) {
    clampLateTimes(retryResult.data)
    if (isPartial) return mergeDays(currentTrip, retryResult.data.days, targetDays)
    return retryResult.data
  }

  throw new Error('Edit failed: invalid response from AI after retry')
}
