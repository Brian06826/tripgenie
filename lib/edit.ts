import Anthropic from '@anthropic-ai/sdk'
import type { Place } from './types'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured.')
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000 })
  }
  return _client
}

export interface EditResult {
  removed: boolean
  place?: {
    name: string
    nameLocal?: string
    type: Place['type']
    description: string
    arrivalTime?: string
    duration?: string
    googleRating?: number
    yelpRating?: number
    tips?: string
    priceRange?: string
  }
}

const EDIT_SYSTEM_PROMPT = `You are TripGenie's place editor. The user wants to modify a single stop in their trip itinerary. You receive the current place data and an edit instruction.

Respond ONLY with valid JSON — no markdown, no explanation.

If the user wants to REMOVE this stop, respond: {"removed": true}

Otherwise, respond with a replacement place:
{
  "removed": false,
  "place": {
    "name": "string (English/romanized name)",
    "nameLocal": "string (optional, local script name)",
    "type": "attraction|restaurant|hotel|transport|other",
    "description": "string (1 sentence, name a highlight or signature dish)",
    "arrivalTime": "string (keep same time slot as original, e.g. '12:00 PM')",
    "duration": "string (e.g. '1-2 hours')",
    "googleRating": number (optional, conservative estimate 1.0-5.0),
    "yelpRating": number (optional, US destinations only),
    "tips": "string (optional, 1 sentence)",
    "priceRange": "$|$$|$$$|$$$$ (restaurants only, optional)"
  }
}

RULES:
- Keep the same time slot (arrivalTime) as the original place unless the edit implies a time change.
- Keep the same type unless the edit implies a type change (e.g. "change to restaurant" changes type to restaurant).
- The replacement must be in the same destination city.
- Only recommend real, well-known places you are confident exist.
- For "remove" / "delete" / "skip" instructions, return {"removed": true}.
- For "cheaper" instructions, pick a more affordable alternative.
- For cuisine changes ("make it Japanese", "change to sushi"), find a well-rated restaurant of that cuisine.`

export async function editPlace(
  instruction: string,
  currentPlace: Place,
  destination: string,
  language: string,
): Promise<EditResult> {
  const userMessage = `DESTINATION: ${destination}
LANGUAGE: ${language}
CURRENT PLACE: ${JSON.stringify({
    name: currentPlace.name,
    nameLocal: currentPlace.nameLocal,
    type: currentPlace.type,
    description: currentPlace.description,
    arrivalTime: currentPlace.arrivalTime,
    duration: currentPlace.duration,
    priceRange: currentPlace.priceRange,
  })}
EDIT INSTRUCTION: ${instruction}`

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    system: EDIT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  let text = content.text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(text) as EditResult
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as EditResult
    }
    throw new Error('Failed to parse edit response')
  }
}
