import Anthropic from '@anthropic-ai/sdk'
import { TripGenerationSchema, type TripGeneration } from './types'

// Lazy client — avoids module-level crash if ANTHROPIC_API_KEY is missing
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Vercel Dashboard → Settings → Environment Variables.')
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 55000 })
  }
  return _client
}

const SYSTEM_PROMPT = `You are TripGenie, an expert travel planner for ANY destination worldwide.

Generate detailed, accurate travel itineraries for any city or country. You MUST respond with ONLY valid JSON — no markdown fences, no explanation text, no refusals, nothing before or after the JSON object.

Language rules:
1. Detect the dominant language of the user's input. If they write in English, respond in English. If they write in Traditional Chinese, respond in Traditional Chinese. If they write in Simplified Chinese, respond in Simplified Chinese. If they write in Japanese, Korean, or another language, respond in English.
2. If the input is mixed, use whichever language makes up the majority of the text.
3. If the user explicitly requests a language (e.g. "reply in Chinese", "用英文回覆", "respond in English"), always use that language regardless of input language.
4. Set the "language" field accordingly: "en" for English, "zh-TW" for Traditional Chinese, "zh-HK" for Cantonese/Hong Kong Chinese, "zh-CN" for Simplified Chinese.
5. ALL descriptive text (title, day titles, descriptions, tips, parking/transit details) must be in the detected/requested language.
6. Place names: ALWAYS populate both "name" (English or romanized) and "nameLocal" (local script characters) when both exist, regardless of output language.

The JSON must match this exact schema:
{
  "title": "string (trip title in the output language)",
  "destination": "string (main destination city/country)",
  "language": "en | zh-TW | zh-HK | zh-CN",
  "days": [
    {
      "dayNumber": 1,
      "title": "string (day title in the output language)",
      "places": [
        {
          "name": "string (English or romanized name)",
          "nameLocal": "string (local script — include whenever it exists, regardless of output language)",
          "type": "attraction | restaurant | hotel | transport | other",
          "description": "string (2-3 sentences with specific menu items for restaurants, highlights for attractions)",
          "arrivalTime": "string (e.g. '10:00 AM', optional)",
          "duration": "string (e.g. '2-3 hours', optional)",
          "googleRating": number (1-5, your best estimate, optional),
          "googleReviewCount": number (approximate, optional),
          "yelpRating": number (1-5, only include for US destinations where Yelp is used, optional),
          "yelpReviewCount": number (approximate, only for US destinations, optional),
          "address": "string (full street address in local format)",
          "parking": {
            "available": boolean,
            "type": "free | paid | street | valet | structure",
            "details": "string (for international cities, describe subway/transit access if driving is not typical)",
            "tips": "string (optional)"
          },
          "tips": "string (insider tips, optional)",
          "priceRange": "$ | $$ | $$$ | $$$$ (for restaurants, optional)",
          "backupOptions": [
            {
              "name": "string",
              "nameLocal": "string (optional)",
              "description": "string (1-2 sentences)",
              "googleRating": number,
              "yelpRating": number (optional, only for US),
              "address": "string"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Generate itineraries for ANY destination worldwide — Tokyo, Seoul, Hong Kong, Paris, New York, anywhere.
- Each day MUST follow this exact structure (5-6 stops, no more):
  • 9:00–11:00 AM — 1 morning attraction or activity
  • 12:00–1:00 PM — 1 lunch restaurant
  • 2:00–5:00 PM — 1 or 2 afternoon attractions (budget travel time between stops)
  • 6:00–7:30 PM — 1 dinner restaurant
  • 8:00–9:30 PM — 1 evening activity (dessert café, boba, bar/lounge, night market, waterfront walk, night view)
- Do NOT put restaurants at 3 PM, 11 AM, or any non-meal time. Meals are at noon and 6 PM only.
- ALWAYS include exactly 2 backupOptions for every restaurant and attraction (skip hotel, transport, other)
- Backup options MUST be different places — never repeat the main place name in its own backupOptions
- ALWAYS include parking or transit info for every place (for cities like Tokyo/Seoul, subway directions are more useful than parking)
- Ratings are your best estimate from training data — labeled as approximate
- Be specific: name actual dishes, actual subway lines/exits, real addresses in local format
- For non-US destinations, omit yelpRating/yelpReviewCount (Yelp is not used outside North America)`

function buildRetryPrompt(originalPrompt: string, zodErrors: string): string {
  return `Previous attempt failed JSON validation. Errors: ${zodErrors}

Fix ONLY these validation issues and return ONLY valid JSON matching the schema. No markdown, no explanation, no refusals.

Original request: ${originalPrompt}`
}

function buildConciseRetryPrompt(originalPrompt: string): string {
  return `Response was cut off due to length. Regenerate the same itinerary but be more concise:
- descriptions: 1-2 sentences max
- tips: 1 sentence max
- parking/transit details: brief (e.g. "Take the JR Yamanote Line" not a paragraph)
- Still include all places and backup options

Return ONLY valid JSON. No markdown, no explanation, no refusals.

Original request: ${originalPrompt}`
}

function buildRefusalRetryPrompt(originalPrompt: string): string {
  return `You must respond with ONLY valid JSON — no explanation, no refusal, no caveats.

Generate the travel itinerary for this request as a JSON object matching the schema. The destination may be anywhere in the world.

Request: ${originalPrompt}`
}

function looksLikeRefusal(text: string): boolean {
  // A valid JSON response starts with { (after trimming)
  if (text.trimStart().startsWith('{')) return false
  // If we get here, it's plain text — definitely a refusal or error
  return true
}

export async function generateTrip(userPrompt: string): Promise<TripGeneration> {
  // Attempt 1
  let firstParsed: unknown
  let truncated = false
  let wasRefusal = false

  try {
    const { parsed, wasTruncated, wasRefusal: refusal } = await callClaude(userPrompt)
    firstParsed = parsed
    truncated = wasTruncated
    wasRefusal = refusal
  } catch (err) {
    // JSON parse failed entirely on attempt 1 — retry concise
    console.error('Attempt 1 parse error:', err)
    try {
      const { parsed } = await callClaude(buildConciseRetryPrompt(userPrompt))
      const r = TripGenerationSchema.safeParse(parsed)
      if (r.success) return r.data
      throw new Error(`Validation failed after concise retry: ${JSON.stringify(r.error.issues)}`)
    } catch (retryErr) {
      throw new Error(`Unable to generate itinerary. Please rephrase your request and try again.`)
    }
  }

  // If Claude refused, force it with the refusal retry prompt
  if (wasRefusal) {
    console.warn('Claude refused — retrying with forced JSON prompt')
    try {
      const { parsed } = await callClaude(buildRefusalRetryPrompt(userPrompt))
      const r = TripGenerationSchema.safeParse(parsed)
      if (r.success) return r.data
    } catch {
      // fall through to final error
    }
    throw new Error(`Unable to generate itinerary for this destination. Please try rephrasing your request.`)
  }

  const firstResult = TripGenerationSchema.safeParse(firstParsed)
  if (firstResult.success) return firstResult.data

  // Attempt 2: truncated → concise, otherwise → Zod error feedback
  const retryPrompt = truncated
    ? buildConciseRetryPrompt(userPrompt)
    : buildRetryPrompt(userPrompt, JSON.stringify(firstResult.error.issues.map(e => ({
        path: e.path.map(String).join('.'),
        message: e.message,
      }))))

  try {
    const { parsed: retryParsed } = await callClaude(retryPrompt)
    const retryResult = TripGenerationSchema.safeParse(retryParsed)
    if (retryResult.success) return retryResult.data
    throw new Error(`Validation failed: ${JSON.stringify(retryResult.error.issues)}`)
  } catch {
    throw new Error(`Unable to generate itinerary. Please try again or rephrase your request.`)
  }
}

async function callClaude(prompt: string): Promise<{ parsed: unknown; wasTruncated: boolean; wasRefusal: boolean }> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')

  const wasTruncated = message.stop_reason === 'max_tokens'

  // Strip any accidental markdown fences
  let text = content.text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Detect refusals before attempting JSON parse
  if (looksLikeRefusal(text)) {
    console.warn('Refusal detected. Response preview:', text.slice(0, 200))
    return { parsed: null, wasTruncated, wasRefusal: true }
  }

  // Try direct parse
  try {
    return { parsed: JSON.parse(text), wasTruncated, wasRefusal: false }
  } catch {
    // Fallback: extract outermost {...}
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return { parsed: JSON.parse(text.slice(start, end + 1)), wasTruncated, wasRefusal: false }
      } catch {
        // extraction also failed
      }
    }
    throw new Error(`Failed to parse Claude response as JSON. stop_reason=${message.stop_reason}, length=${text.length}`)
  }
}
