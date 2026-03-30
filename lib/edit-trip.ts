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

const EDIT_TRIP_SYSTEM_PROMPT = `You are TripGenie's trip editor. You receive an existing trip itinerary as JSON and the user's edit instruction. Modify the trip according to the instruction and return the COMPLETE updated trip JSON.

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
- Hotels/check-in: 3:00 PM - 6:00 PM.

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
- FINAL CHECK: Before returning, scan EVERY arrivalTime. If ANY time is after 9:30 PM, change it to be earlier. Dinner must be between 6:00 PM and 8:00 PM.

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

export async function editTrip(
  currentTrip: TripGeneration,
  instruction: string,
  language: string,
): Promise<TripGeneration> {
  const userMessage = `CURRENT TRIP:
${JSON.stringify(currentTrip, null, 2)}

EDIT INSTRUCTION: ${instruction}
LANGUAGE: ${language}

Return the complete updated trip JSON with modifications applied.`

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 14000,
    system: EDIT_TRIP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const parsed = parseJsonResponse(content.text)
  const result = TripGenerationSchema.safeParse(parsed)
  if (result.success) return result.data

  // One retry with validation errors
  const retryMessage = `Previous response had validation errors: ${JSON.stringify(
    result.error.issues.map(e => ({ path: e.path.join('.'), message: e.message }))
  )}

Fix the errors and return ONLY valid JSON matching the schema.

CURRENT TRIP:
${JSON.stringify(currentTrip, null, 2)}

EDIT INSTRUCTION: ${instruction}`

  const retryResponse = await getClient().messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 14000,
    system: EDIT_TRIP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: retryMessage }],
  })

  const retryContent = retryResponse.content[0]
  if (retryContent.type !== 'text') throw new Error('Unexpected retry response type')

  const retryParsed = parseJsonResponse(retryContent.text)
  const retryResult = TripGenerationSchema.safeParse(retryParsed)
  if (retryResult.success) return retryResult.data

  throw new Error('Edit failed: invalid response from AI after retry')
}
