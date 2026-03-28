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

// ---------------------------------------------------------------------------
// Input validation — no Claude API call, regex only
// ---------------------------------------------------------------------------

const TRAVEL_KEYWORDS_EN = /\b(trip|travel|tour|visit|vacation|itinerary|holiday|getaway|weekend|explore|stay|route|guide|attraction|hotel|restaurant|food|beach|mountain|museum|flight|cruise|road.?trip)\b/i
const TRAVEL_KEYWORDS_CJK = /旅行|行程|遊|日遊|自由行|旅遊|景點|美食|住宿|酒店|觀光|出行|玩/
const DURATION_EN = /\b(\d+\s*(days?|nights?|weeks?)|day.?trip|weekend|one.?day)\b/i
const DURATION_CJK = /[一二三四五六七八九十\d]\s*(日|天|夜|晚|週)|週末|假期/

// Patterns that are clearly not trip requests
const GREETING = /^(hi|hello|hey|sup|yo|howdy|你好|哈囉|嗨|早安|晚安)[!.,?\s]*$/i
const META_QUESTION = /^(what('s| is) your (name|purpose)|who are you|tell me about yourself|你係咪|你是誰|你叫什麼)/i
const WHAT_IS = /^(what\s+(is|are|does|can)|什麼是|什麼叫|解釋|說明)\s+\w/i
const HELP_NON_TRAVEL = /^(help me (with|to write|understand|explain|calculate|translate|code)|幫我(寫|翻|解|算|做功課))/i
const PURE_QUESTION = /^(how (are|do|does|can|should|would)|why (is|are|do|does)|when (is|are|do)|where (is|are|do))\s/i

const NOT_TRIP_MESSAGE =
  "Please describe a trip! Include a destination and duration.\nFor example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'"

export function validateTripRequest(prompt: string): { valid: true } | { valid: false; message: string } {
  const trimmed = prompt.trim()

  if (trimmed.length < 2) {
    return { valid: false, message: NOT_TRIP_MESSAGE }
  }

  // Fast-accept: any travel or duration keyword found
  if (
    TRAVEL_KEYWORDS_EN.test(trimmed) ||
    TRAVEL_KEYWORDS_CJK.test(trimmed) ||
    DURATION_EN.test(trimmed) ||
    DURATION_CJK.test(trimmed)
  ) {
    return { valid: true }
  }

  // Fast-reject: clearly not a trip request
  if (
    GREETING.test(trimmed) ||
    META_QUESTION.test(trimmed) ||
    WHAT_IS.test(trimmed) ||
    HELP_NON_TRAVEL.test(trimmed) ||
    PURE_QUESTION.test(trimmed)
  ) {
    return { valid: false, message: NOT_TRIP_MESSAGE }
  }

  // Everything else: benefit of the doubt (bare city names, "Tokyo", "巴黎", etc.)
  return { valid: true }
}

// ---------------------------------------------------------------------------
// Trip length detection
// ---------------------------------------------------------------------------

const CHINESE_DIGITS: Record<string, number> = {
  '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
}

export function detectTripDays(prompt: string): number {
  const p = prompt.toLowerCase()

  // Explicit 1-day signals
  if (/(一日|一天|day.?trip|1.?day|one.?day|1日|1天)/i.test(prompt)) return 1

  // "一週" / "一星期" / "a week" → 7
  if (/(一週|一星期|a week|7.?day)/i.test(prompt)) return 7

  // Arabic digits: "3 days", "5-day", "10日", "4天", "3日4夜" etc.
  const arabicMatch = prompt.match(/(\d+)\s*[-–]?\s*(day|days|日|天|夜|nights?)/i)
  if (arabicMatch) return parseInt(arabicMatch[1], 10)

  // Chinese numeral: "三日", "五天", "四夜", "三日四夜"
  for (const [char, val] of Object.entries(CHINESE_DIGITS)) {
    if (new RegExp(`${char}(日|天|夜|晚)`).test(prompt)) return val
  }

  // "X nights" → X+1 days (approximate)
  const nightMatch = prompt.match(/(\d+)\s*night/i)
  if (nightMatch) return parseInt(nightMatch[1], 10) + 1

  // Default: assume 2-day if no signal
  return 2
}

// ---------------------------------------------------------------------------
// Tier selection
// ---------------------------------------------------------------------------

type Tier = 1 | 2 | 3

function getTier(days: number): Tier {
  if (days <= 2) return 1
  if (days <= 4) return 2
  return 3
}

function getMaxTokens(_tier: Tier): number {
  return 12000
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_BASE = `You are TripGenie, an expert travel planner for ANY destination worldwide.

Generate detailed, accurate travel itineraries for any city or country. You MUST respond with ONLY valid JSON — no markdown fences, no explanation text, no refusals, nothing before or after the JSON object.

QUALITY STANDARDS — apply to EVERY place you recommend:
- Only recommend REAL, VERIFIED places that actually exist. Never invent or hallucinate names.
- Prioritize well-known, popular places that travelers actually visit — famous landmarks, beloved local institutions, top-rated experiences.
- For RESTAURANTS: only recommend places with an estimated Google rating ≥ 4.0 and at least 500+ reviews. Prefer celebrated local favorites and well-reviewed establishments over obscure spots.
- For ATTRACTIONS: only recommend places with a Google rating ≥ 4.0 and a recognizable name (famous museums, landmarks, popular markets, well-known viewpoints).
- All places MUST be physically located within or immediately adjacent to the requested destination. Never recommend a place in a different city or region.
- NEVER repeat a place across the itinerary. Each restaurant and attraction must appear at most once — if a place is a main recommendation for any stop, it must NOT appear in any backup options for any other stop, and vice versa.
- When estimating ratings, be conservative. Only assign 4.5+ if you are confident the place is widely acclaimed. Never assign 4.8+ unless it is world-famous.

Language rules:
1. Detect the dominant language of the user's input. If they write in English, respond in English. If they write in Traditional Chinese, respond in Traditional Chinese. If they write in Simplified Chinese, respond in Simplified Chinese. If they write in Japanese, Korean, or another language, respond in English.
2. If the input is mixed, use whichever language makes up the majority of the text.
3. If the user explicitly requests a language (e.g. "reply in Chinese", "用英文回覆", "respond in English"), always use that language regardless of input language.
4. Set the "language" field accordingly: "en" for English, "zh-TW" for Traditional Chinese, "zh-HK" for Cantonese/Hong Kong Chinese, "zh-CN" for Simplified Chinese.
5. ALL descriptive text (title, day titles, descriptions, tips, parking/transit details) must be in the detected/requested language.
6. Place names: ALWAYS populate both "name" (English or romanized) and "nameLocal" (local script characters) when both exist, regardless of output language.`

const SCHEMA_FULL = `
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
          "nameLocal": "string (local script — include whenever it exists)",
          "type": "attraction | restaurant | hotel | transport | other",
          "description": "string (2-3 sentences with specific menu items for restaurants, highlights for attractions)",
          "arrivalTime": "string (e.g. '10:00 AM', optional)",
          "duration": "string (e.g. '2-3 hours', optional)",
          "googleRating": number (1-5, your best estimate, optional),
          "googleReviewCount": number (approximate, optional),
          "yelpRating": number (1-5, only include for US destinations, optional),
          "yelpReviewCount": number (approximate, only for US destinations, optional),
          "address": "string (full street address in local format)",
          "parking": {
            "available": boolean,
            "type": "free | paid | street | valet | structure",
            "details": "string (for international cities, describe subway/transit access)",
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

const SCHEMA_MEDIUM = `
The JSON must match this exact schema:
{
  "title": "string",
  "destination": "string",
  "language": "en | zh-TW | zh-HK | zh-CN",
  "days": [
    {
      "dayNumber": 1,
      "title": "string",
      "places": [
        {
          "name": "string (English or romanized name)",
          "nameLocal": "string (local script, when it exists)",
          "type": "attraction | restaurant | hotel | transport | other",
          "description": "string (1 sentence only — name 1 signature dish or highlight)",
          "arrivalTime": "string (optional)",
          "duration": "string (optional)",
          "googleRating": number (optional),
          "googleReviewCount": number (optional),
          "yelpRating": number (US only, optional),
          "yelpReviewCount": number (US only, optional),
          "address": "string",
          "tips": "string (1 sentence, optional)",
          "priceRange": "$ | $$ | $$$ | $$$$ (restaurants only, optional)",
          "backupOptions": [
            {
              "name": "string",
              "nameLocal": "string (optional)",
              "description": "string (1 sentence)",
              "googleRating": number,
              "address": "string"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Generate itineraries for ANY destination worldwide.
- Each day: exactly 5 stops — 1 morning attraction, 1 lunch, 1-2 afternoon attractions, 1 dinner, 1 evening activity.
- Meals at noon and 6 PM only. No restaurants at other times.
- Include exactly 1 backupOption per restaurant and attraction (skip hotel, transport, other).
- Omit parking entirely — do NOT include a parking field.
- Descriptions: 1 sentence max. Be specific (dish names, highlights).
- Be specific: real addresses, actual subway lines for international cities.
- For non-US destinations, omit yelpRating/yelpReviewCount.`

const SCHEMA_LEAN = `
The JSON must match this exact schema:
{
  "title": "string",
  "destination": "string",
  "language": "en | zh-TW | zh-HK | zh-CN",
  "days": [
    {
      "dayNumber": 1,
      "title": "string",
      "places": [
        {
          "name": "string (English or romanized name)",
          "nameLocal": "string (local script, when it exists)",
          "type": "attraction | restaurant | hotel | transport | other",
          "description": "string (1 sentence — 1 key highlight or signature dish)",
          "arrivalTime": "string (optional)",
          "googleRating": number (optional),
          "address": "string",
          "priceRange": "$ | $$ | $$$ | $$$$ (restaurants only, optional)"
        }
      ]
    }
  ]
}

Rules:
- Generate itineraries for ANY destination worldwide.
- Each day: exactly 3-4 stops — 1 attraction, 1 lunch, 1 attraction or dinner, 1 dinner or evening activity.
- Meals at noon and 6 PM only.
- NO backupOptions — omit entirely.
- NO parking field — omit entirely.
- NO tips field — omit entirely.
- Descriptions: 1 sentence max. Be specific (dish names, one highlight).
- Real addresses. For international cities, a brief transit note is fine inside description.
- For non-US destinations, omit yelpRating/yelpReviewCount.`

function buildSystemPrompt(tier: Tier): string {
  switch (tier) {
    case 1: return SYSTEM_PROMPT_BASE + SCHEMA_FULL
    case 2: return SYSTEM_PROMPT_BASE + SCHEMA_MEDIUM
    case 3: return SYSTEM_PROMPT_BASE + SCHEMA_LEAN
  }
}

// ---------------------------------------------------------------------------
// Retry prompt builders
// ---------------------------------------------------------------------------

function buildRetryPrompt(originalPrompt: string, zodErrors: string): string {
  return `Previous attempt failed JSON validation. Errors: ${zodErrors}

Fix ONLY these validation issues and return ONLY valid JSON matching the schema. No markdown, no explanation, no refusals.

Original request: ${originalPrompt}`
}

function buildConciseRetryPrompt(originalPrompt: string): string {
  return `Response was cut off due to length. Regenerate the same itinerary but be more concise:
- descriptions: 1 sentence max
- tips: omit
- parking: omit
- Still include all days and places

Return ONLY valid JSON. No markdown, no explanation, no refusals.

Original request: ${originalPrompt}`
}

function buildRefusalRetryPrompt(originalPrompt: string): string {
  return `You must respond with ONLY valid JSON — no explanation, no refusal, no caveats.

Generate the travel itinerary for this request as a JSON object matching the schema. The destination may be anywhere in the world.

Request: ${originalPrompt}`
}

// Attempt to close an incomplete JSON string that was cut off by max_tokens.
// Walks the text tracking string state and bracket stack, then:
//   1. Closes any unclosed string literal
//   2. Strips trailing commas (invalid after truncation)
//   3. Appends closing } or ] for every unclosed container
// Returns null if the result still can't be parsed.
function repairTruncatedJson(raw: string): string | null {
  let inString = false
  let escaped = false
  const stack: Array<'{' | '['> = []

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\' && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') stack.push(ch as '{' | '[')
    else if (ch === '}' || ch === ']') stack.pop()
  }

  let s = raw

  // Close an unclosed string literal
  if (inString) s += '"'

  // Strip trailing whitespace and commas (common artifact of truncation)
  s = s.trimEnd()
  while (s.endsWith(',')) s = s.slice(0, -1).trimEnd()

  // Close every unclosed container in reverse stack order
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']'
  }

  try {
    JSON.parse(s)
    return s
  } catch {
    // Still invalid — try dropping the last incomplete property (after last comma)
    const lastComma = s.lastIndexOf(',')
    if (lastComma > 0) {
      let trimmed = s.slice(0, lastComma).trimEnd()
      // Re-close containers from scratch on the trimmed string
      const repaired = repairTruncatedJson(trimmed)
      return repaired
    }
    return null
  }
}

function looksLikeRefusal(text: string): boolean {
  if (text.trimStart().startsWith('{')) return false
  return true
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateTrip(userPrompt: string, onChunk?: () => void): Promise<TripGeneration> {
  const validation = validateTripRequest(userPrompt)
  if (!validation.valid) throw new Error(validation.message)

  const days = detectTripDays(userPrompt)
  const tier = getTier(days)
  const systemPrompt = buildSystemPrompt(tier)
  const maxTokens = getMaxTokens(tier)

  // Attempt 1 — use streaming if caller wants heartbeats, otherwise plain
  let firstParsed: unknown
  let truncated = false
  let wasRefusal = false

  try {
    const { parsed, wasTruncated, wasRefusal: refusal } = onChunk
      ? await callClaudeStreaming(userPrompt, systemPrompt, maxTokens, onChunk)
      : await callClaude(userPrompt, systemPrompt, maxTokens)
    firstParsed = parsed
    truncated = wasTruncated
    wasRefusal = refusal
  } catch (err) {
    console.error('Attempt 1 parse error:', err)
    try {
      const { parsed } = await callClaude(buildConciseRetryPrompt(userPrompt), systemPrompt, maxTokens)
      const r = TripGenerationSchema.safeParse(parsed)
      if (r.success) return r.data
      throw new Error(`Validation failed after concise retry: ${JSON.stringify(r.error.issues)}`)
    } catch {
      throw new Error(`Unable to generate itinerary. Please rephrase your request and try again.`)
    }
  }

  if (wasRefusal) {
    console.warn('Claude refused — retrying with forced JSON prompt')
    try {
      const { parsed } = await callClaude(buildRefusalRetryPrompt(userPrompt), systemPrompt, maxTokens)
      const r = TripGenerationSchema.safeParse(parsed)
      if (r.success) return r.data
    } catch {
      // fall through
    }
    throw new Error(`Unable to generate itinerary for this destination. Please try rephrasing your request.`)
  }

  const firstResult = TripGenerationSchema.safeParse(firstParsed)
  if (firstResult.success) return firstResult.data

  // Attempt 2
  const retryPrompt = truncated
    ? buildConciseRetryPrompt(userPrompt)
    : buildRetryPrompt(userPrompt, JSON.stringify(firstResult.error.issues.map(e => ({
        path: e.path.map(String).join('.'),
        message: e.message,
      }))))

  try {
    const { parsed: retryParsed } = await callClaude(retryPrompt, systemPrompt, maxTokens)
    const retryResult = TripGenerationSchema.safeParse(retryParsed)
    if (retryResult.success) return retryResult.data
    throw new Error(`Validation failed: ${JSON.stringify(retryResult.error.issues)}`)
  } catch {
    throw new Error(`Unable to generate itinerary. Please try again or rephrase your request.`)
  }
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

async function callClaudeStreaming(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  onChunk: () => void,
): Promise<{ parsed: unknown; wasTruncated: boolean; wasRefusal: boolean }> {
  const stream = getClient().messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  let fullText = ''
  let tokenCount = 0
  stream.on('text', (text: string) => {
    fullText += text
    // Emit heartbeat every 20 tokens — enough to keep the SSE connection alive
    if (++tokenCount % 20 === 0) onChunk()
  })

  const finalMessage = await stream.finalMessage()
  const wasTruncated = finalMessage.stop_reason === 'max_tokens'

  let text = fullText.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (looksLikeRefusal(text)) {
    console.warn('Refusal detected (stream). Preview:', text.slice(0, 200))
    return { parsed: null, wasTruncated, wasRefusal: true }
  }

  try {
    return { parsed: JSON.parse(text), wasTruncated, wasRefusal: false }
  } catch {
    // Try extracting outermost {...}
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return { parsed: JSON.parse(text.slice(start, end + 1)), wasTruncated, wasRefusal: false }
      } catch {}
    }
    // If truncated, attempt structural repair before giving up
    if (wasTruncated) {
      const repaired = repairTruncatedJson(start !== -1 ? text.slice(start) : text)
      if (repaired !== null) {
        console.warn('Streaming response repaired after truncation')
        return { parsed: JSON.parse(repaired), wasTruncated: true, wasRefusal: false }
      }
    }
    throw new Error(`Failed to parse streaming Claude response. stop_reason=${finalMessage.stop_reason}, length=${text.length}`)
  }
}

async function callClaude(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
): Promise<{ parsed: unknown; wasTruncated: boolean; wasRefusal: boolean }> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')

  const wasTruncated = message.stop_reason === 'max_tokens'

  let text = content.text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (looksLikeRefusal(text)) {
    console.warn('Refusal detected. Response preview:', text.slice(0, 200))
    return { parsed: null, wasTruncated, wasRefusal: true }
  }

  try {
    return { parsed: JSON.parse(text), wasTruncated, wasRefusal: false }
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return { parsed: JSON.parse(text.slice(start, end + 1)), wasTruncated, wasRefusal: false }
      } catch {}
    }
    if (wasTruncated) {
      const repaired = repairTruncatedJson(start !== -1 ? text.slice(start) : text)
      if (repaired !== null) {
        console.warn('Response repaired after truncation')
        return { parsed: JSON.parse(repaired), wasTruncated: true, wasRefusal: false }
      }
    }
    throw new Error(`Failed to parse Claude response as JSON. stop_reason=${message.stop_reason}, length=${text.length}`)
  }
}
