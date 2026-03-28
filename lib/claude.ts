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

export async function generateTrip(userPrompt: string): Promise<TripGeneration> {
  // First attempt
  const firstAttempt = await callClaude(userPrompt)
  const firstResult = TripGenerationSchema.safeParse(firstAttempt)
  if (firstResult.success) return firstResult.data

  // Retry with error context (Zod v4 uses .issues)
  const errors = JSON.stringify(firstResult.error.issues.map(e => ({
    path: e.path.map(String).join('.'),
    message: e.message,
  })))
  const retryAttempt = await callClaude(buildRetryPrompt(userPrompt, errors))
  const retryResult = TripGenerationSchema.safeParse(retryAttempt)
  if (retryResult.success) return retryResult.data

  throw new Error(`Claude returned invalid JSON after retry: ${JSON.stringify(retryResult.error.issues)}`)
}

async function callClaude(prompt: string): Promise<unknown> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')

  // Strip any accidental markdown fences
  const text = content.text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(text)
}
