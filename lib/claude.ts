import Anthropic from '@anthropic-ai/sdk'
import { TripGenerationSchema, type TripGeneration } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are TripGenie, an expert travel planner specializing in trips for Chinese-American travelers in Southern California (LA, San Diego, San Francisco area).

Generate detailed, accurate travel itineraries. You MUST respond with ONLY valid JSON — no markdown fences, no explanation text, nothing before or after the JSON object.

The JSON must match this exact schema:
{
  "title": "string (trip title, e.g. '5日4夜 San Diego 之旅')",
  "destination": "string (main destination)",
  "language": "en | zh-TW | zh-HK (match the user's input language)",
  "days": [
    {
      "dayNumber": 1,
      "title": "string (day title, e.g. 'Day 1: SeaWorld + 海邊晚餐')",
      "places": [
        {
          "name": "string (English name)",
          "nameLocal": "string (Chinese name if available, optional)",
          "type": "attraction | restaurant | hotel | transport | other",
          "description": "string (2-3 sentences with specific menu items for restaurants, highlights for attractions)",
          "arrivalTime": "string (e.g. '10:00 AM', optional)",
          "duration": "string (e.g. '2-3 hours', optional)",
          "googleRating": number (1-5, your best estimate),
          "googleReviewCount": number (approximate),
          "yelpRating": number (1-5, your best estimate),
          "yelpReviewCount": number (approximate),
          "address": "string (full street address)",
          "parking": {
            "available": boolean,
            "type": "free | paid | street | valet | structure",
            "details": "string (specific parking info, e.g. '$20/day structure parking nearby')",
            "tips": "string (optional tips, e.g. 'Arrive early for street parking on weekends')"
          },
          "tips": "string (insider tips, optional)",
          "priceRange": "$ | $$ | $$$ | $$$$ (for restaurants, optional)",
          "backupOptions": [
            {
              "name": "string",
              "nameLocal": "string (optional)",
              "description": "string (1-2 sentences)",
              "googleRating": number,
              "yelpRating": number,
              "address": "string"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Each day MUST have 5-7 activities covering the FULL day: morning activity or breakfast spot, lunch restaurant, afternoon activity, dinner restaurant, AND at least one evening activity. Never end a day at dinner.
- Evening activities: night market, dessert café, boba shop, bar or lounge, evening walk or waterfront promenade, night view spot, karaoke, arcade, or similar. Be specific and local.
- ALWAYS include exactly 2 backupOptions for every restaurant and attraction place (skip hotel, transport, other)
- ALWAYS include parking info for every place
- Use the SAME language as the user's request (Chinese in → Chinese out)
- Ratings are your best estimate from training data, labeled as approximate
- Be specific: name actual dishes, specific parking lots, real addresses
- For SoCal destinations, focus on authentic, community-vetted spots`

function buildRetryPrompt(originalPrompt: string, zodErrors: string): string {
  return `Previous attempt failed JSON validation. Errors: ${zodErrors}

Fix these issues and return ONLY valid JSON matching the schema. No markdown, no explanation.

Original request: ${originalPrompt}`
}

function buildConciseRetryPrompt(originalPrompt: string): string {
  return `Response was cut off due to length. Regenerate the same itinerary but be more concise:
- descriptions: 1-2 sentences max
- tips: 1 sentence max
- parking details: brief (e.g. "Street parking, free" not a paragraph)
- Still include all places and backup options

Return ONLY valid JSON. No markdown, no explanation.

Original request: ${originalPrompt}`
}

export async function generateTrip(userPrompt: string): Promise<TripGeneration> {
  // First attempt
  let firstParsed: unknown
  let truncated = false
  try {
    const { parsed, wasTruncated } = await callClaude(userPrompt)
    firstParsed = parsed
    truncated = wasTruncated
  } catch (err) {
    // JSON parse error on first attempt — retry with concise mode
    console.error('First attempt JSON parse error:', err)
    const { parsed: retryParsed } = await callClaude(buildConciseRetryPrompt(userPrompt))
    const retryResult = TripGenerationSchema.safeParse(retryParsed)
    if (retryResult.success) return retryResult.data
    throw new Error(`Claude returned invalid JSON after parse-error retry: ${JSON.stringify(retryResult.error.issues)}`)
  }

  const firstResult = TripGenerationSchema.safeParse(firstParsed)
  if (firstResult.success) return firstResult.data

  // Retry: if truncated, ask for shorter response; otherwise send Zod errors
  const retryPrompt = truncated
    ? buildConciseRetryPrompt(userPrompt)
    : buildRetryPrompt(userPrompt, JSON.stringify(firstResult.error.issues.map(e => ({
        path: e.path.map(String).join('.'),
        message: e.message,
      }))))

  const { parsed: retryParsed } = await callClaude(retryPrompt)
  const retryResult = TripGenerationSchema.safeParse(retryParsed)
  if (retryResult.success) return retryResult.data

  throw new Error(`Claude returned invalid JSON after retry: ${JSON.stringify(retryResult.error.issues)}`)
}

async function callClaude(prompt: string): Promise<{ parsed: unknown; wasTruncated: boolean }> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 12000,
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

  // Try direct parse first
  try {
    return { parsed: JSON.parse(text), wasTruncated }
  } catch {
    // Fallback: extract outermost {...} in case there's leading/trailing non-JSON text
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return { parsed: JSON.parse(text.slice(start, end + 1)), wasTruncated }
    }
    throw new Error(`Failed to parse Claude response as JSON. stop_reason=${message.stop_reason}, length=${text.length}`)
  }
}
