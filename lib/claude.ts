import Anthropic from '@anthropic-ai/sdk'
import { TripGenerationSchema, type TripGeneration } from './types'

// Lazy client — avoids module-level crash if ANTHROPIC_API_KEY is missing
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Vercel Dashboard → Settings → Environment Variables.')
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180000 })
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
const GREETING = /^(hi|hello|hey|sup|yo|howdy|你好|哈囉|嗨|早安|晚安)\b/i
const META_QUESTION = /^(what('s| is) your (name|purpose)|who are you|tell me about yourself|你係咪|你是誰|你叫什麼)/i
const WHAT_IS = /^(what\s+(is|are|does|can)|什麼是|什麼叫|解釋|說明)\s+\w/i
const HELP_NON_TRAVEL = /^(help me (with|to write|understand|explain|calculate|translate|code)|幫我(寫|翻|解|算|做功課))/i
const PURE_QUESTION = /^(how (are|do|does|can|should|would)|why (is|are|do|does)|when (is|are|do)|where (is|are|do))\s/i
const CHAT_GENERIC = /^(tell me|write me|can you|please (help|write|explain|translate)|thank|thanks|good (morning|afternoon|evening)|nice to|I('m| am) (bored|tired|hungry|sad|happy))\b/i

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
    PURE_QUESTION.test(trimmed) ||
    CHAT_GENERIC.test(trimmed)
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

  // "N weeks" → N * 7
  const weekMatch = prompt.match(/(\d+)\s*weeks?/i)
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7

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

function getMaxTokens(tier: Tier): number {
  if (tier === 1) return 6000   // 1-2 days
  if (tier === 2) return 10000  // 3-4 days
  return 14000                  // 5+ days
}

// ---------------------------------------------------------------------------
// System prompt (single unified prompt for all tiers)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are TripGenie, an AI trip planner. Respond ONLY with valid JSON — no markdown, no explanation, no text outside the JSON object.

GEOGRAPHIC CONSTRAINT (CRITICAL): Every place you recommend MUST be physically located WITHIN the destination city or its immediate vicinity (within 5 miles). NEVER recommend a place in a different city. For "Long Beach day trip", every place must be IN Long Beach — not Hollywood, not Santa Monica, not LA. Before including any place, verify: is this place actually in the destination? If unsure, choose a different place that you know is local.

MULTI-CITY / REGION TRIPS: If the user requests a region (e.g. "Southeast Asia", "Europe", "Japan"), pick the most logical cities and split the trip across them, allocating 2-3 days per city. Set "destination" to the region name. For example, "2 weeks Southeast Asia" → Bangkok (3 days) → Chiang Mai (2 days) → Hanoi (3 days) → Ho Chi Minh City (2 days) → Siem Reap (3 days). Include inter-city transport as type "transport" stops between cities. Within each city segment, the geographic constraint applies — all stops must be in THAT city.

ANTI-HALLUCINATION: Only recommend restaurants you are CONFIDENT have high ratings on Google (4.0+) or Yelp (4+ stars) with many reviews (200+). Recommend popular local favorites that real people actually review and visit, not chain restaurants. If you are not 100% sure a restaurant exists at that specific location, DO NOT include it. It is better to recommend fewer places than to include a fake one.

LANGUAGE: Detect language ONLY by the CHARACTER SCRIPT of the user's input — not by destination names, place names, or topic.
- All Latin/ASCII characters (a-z, A-Z) → English. Set "language": "en". Respond in English.
- Contains Traditional Chinese characters (繁體字) → Traditional Chinese. Set "language": "zh-TW".
- Contains Simplified Chinese characters (简体字) → Simplified Chinese. Set "language": "zh-CN".
- Contains Cantonese-specific phrasing with Traditional characters → Set "language": "zh-HK".
- If mixed scripts, use whichever script has MORE characters.
- If the user explicitly requests a language, always honor that request.
CRITICAL: "hong kong", "tokyo", "taipei" written in Latin letters = English input. Do NOT switch to Chinese just because the destination is in Asia. The script of the INPUT text determines the language, not the destination.
ALL descriptive text (titles, descriptions, tips) must be in the detected language. Place names: always include both "name" (English/romanized) and "nameLocal" (local script) when both exist.

JSON schema:
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
      "description": "string (1 sentence — name a signature dish or key highlight)",
      "arrivalTime": "string (optional, e.g. '9:00 AM')",
      "duration": "string (optional, e.g. '1-2 hours')",
      "googleRating": number (optional, 1.0-5.0),
      "googleReviewCount": number (optional),
      "yelpRating": number (US destinations only, optional),
      "yelpReviewCount": number (US destinations only, optional),
      "tips": "string (optional, 1 sentence)",
      "priceRange": "$|$$|$$$|$$$$ (restaurants only, optional)",
      "backupOptions": [{
        "name": "string",
        "nameLocal": "string (optional)",
        "description": "string (1 sentence)",
        "googleRating": number (optional)
      }]
    }]
  }]
}

PERSONALIZATION: Read the user's input carefully for signals and adapt:
- "with kids" / "family" → family-friendly stops, skip bars/nightlife, add parks/playgrounds
- "romantic" / "couple" / "date" → scenic spots, upscale dining, intimate venues
- "budget" / "cheap" / "$" → affordable eats ($-$$), free attractions, street food
- "luxury" / "upscale" / "$$$$" → fine dining, premium experiences
- "food-focused" / "foodie" → more restaurants, food markets, culinary experiences
- "nightlife" → include evening bars, live music, late-night spots
- "nature" / "outdoors" → parks, hikes, beaches, scenic viewpoints

STOP COUNT PER DAY (CRITICAL — follow exactly):
- 1-day trip: exactly 5 stops. Structure: morning attraction → lunch → 2 afternoon attractions → dinner.
- 2+ day trips: exactly 4 stops per day. Structure: morning attraction → lunch → afternoon attraction → dinner.
- "relaxed" / "chill": reduce by 1 stop, longer durations. Still include lunch AND dinner.
- "packed" / "maximize": add 1-2 extra stops. Include lunch AND dinner.
- "morning only" / "半日" / "half day": plan until ~1:00 PM. 2-3 stops + lunch. No dinner.
- User-specified times (e.g. "9am-3pm"): respect EXACTLY. Only include meals that fall within those hours.
- Transport stops (departure/return) do NOT count toward the stop count above.

DAILY SCHEDULE RULES (CRITICAL):
1. DEFAULT full-day: 9:00 AM to 9:00 PM. Must include BOTH lunch AND dinner. NEVER end before 6:00 PM.
2. Space activities naturally throughout the day. Morning: 9:00 AM-12:00 PM. Afternoon: 1:30 PM-5:30 PM. Evening: 6:00 PM onward.
3. Leave breathing room between stops — a real trip has natural gaps for walking, browsing, photos, and spontaneous exploration. Don't pack every minute.

STRICT MEAL TIMING (CRITICAL — NEVER VIOLATE — MEALS ARE HIGHER PRIORITY THAN ATTRACTIONS):
- Breakfast/Brunch: 8:00-10:00 AM. Only include if user requests it OR multi-day trip where it makes sense.
- Lunch: 11:30 AM - 1:00 PM. REQUIRED for every full day.
- Dinner: 6:00-8:00 PM. REQUIRED for every full day. NEVER schedule dinner before 5:30 PM under ANY circumstance. A dinner at 4:00 PM or 5:00 PM is WRONG — add afternoon activities to fill the gap between lunch and dinner. If you run out of activities, add a relaxation break, park visit, or shopping time.
- Do NOT add afternoon snack/cafe/dessert stops unless the user specifically asks for them.
- NEVER schedule two full meals (restaurant type stops) within 2 hours of each other.
- Each full day (9 AM-9 PM range) MUST have exactly one lunch restaurant AND one dinner restaurant. This is a HARD RULE, not a guideline. A day without both lunch and dinner is INVALID.
- IF TIME IS TIGHT: shorten attraction durations (e.g. 2 hours → 1 hour) or remove an attraction. NEVER skip or remove a meal to save time. Meals are non-negotiable.

POST-DINNER ACTIVITIES (8:00 PM - 9:00 PM):
- If user selected "Nightlife" chip: add a bar, live music venue, or night market after dinner.
- If user selected "Relaxed" chip: do NOT add anything after dinner, end the day after the meal.
- If user selected "Foodie" chip: add a dessert spot, boba shop, or late-night snack place.
- If "With Kids" or user mentions children: do NOT add post-dinner activities.
- If "With Partner" or "romantic": add a scenic night walk, night view spot, or rooftop bar.
- If no chip selected (default): add ONE optional light activity like an evening stroll, dessert cafe, or waterfront walk. Mark it as "Optional" in the description.
- Post-dinner activities should be SHORT (30-60 min max).
- Post-dinner activity must be CLOSE to the dinner location (walking distance preferred).
- For destinations known for night scenes (Tokyo, Taipei, NYC, Las Vegas, Bangkok): lean towards adding a night activity even without chips.
- NEVER schedule post-dinner activities past 9:30 PM.

SELF-CHECK (MANDATORY — run after generating the full itinerary):
Before returning your JSON, verify EVERY full day has:
1. Exactly one restaurant-type stop between 11:30 AM - 1:00 PM (lunch)
2. Exactly one restaurant-type stop between 6:00 PM - 8:00 PM (dinner)
3. No dinner scheduled before 5:30 PM
If any day fails these checks, fix it before responding. Add a missing meal or move a misplaced one.

TRANSPORTATION & MEETING POINTS:
- If the user mentions a departure point (e.g. "I take metro from Glendora to downtown"), include that as the FIRST stop with type "transport", with the estimated transit time as duration.
- If the user mentions how they're getting there (e.g. "my girlfriend drives to downtown"), acknowledge it and start the itinerary from that arrival point.
- If the user mentions a specific transport mode (metro, train, bus, driving), use that mode for travel time estimates throughout the day and mention it in tips.
- If the user mentions meeting someone at a location, start the itinerary from that meeting point.
- For US cities, assume visitors will drive between stops unless they specify otherwise.
- For cities with excellent public transit (Tokyo, Osaka, Seoul, Hong Kong, Taipei, Singapore, London, Paris, Berlin, New York, San Francisco, Chicago, Boston), recommend specific transit lines/routes in tips (e.g. "Take the JR Yamanote Line to Shibuya Station").
- Group nearby stops together to minimize travel time.
- RETURN TRIP (CRITICAL ORDERING RULE): If the user specifies a departure point or transportation method to reach the destination, ALWAYS include a return trip as the ABSOLUTE LAST stop of the last day. Use type "transport". Dinner and ALL other activities MUST come BEFORE the return trip. Correct order: activities → dinner → return trip home. NEVER place any activity after the return trip. For example, if user takes metro from Glendora to Long Beach, the last stop should be something like "Take Metro Blue Line + Gold Line back to Glendora" with duration "~2 hours" and the departure time AFTER dinner ends (e.g. dinner at 7 PM for 1 hour → return trip at 8:00 PM). Match the same transport mode they used to arrive.

ARRIVAL & DEPARTURE AWARENESS:
- If user mentions arriving at a specific time ("arriving 10am", "landing at 2pm"), start the itinerary from that time, not before.
- If user mentions needing to leave by a time ("need to leave by 5pm", "flight at 8pm"), plan accordingly and end the itinerary with enough buffer time.
- For multi-day trips: Day 1 can start later (arrival day). Last day can end earlier (departure day). Middle days use full schedule.

TIME AWARENESS: If the user specifies start/end times (e.g. "10am to 6pm"), respect them exactly. Never schedule stops outside the user's stated hours. Budget realistic travel time between stops (15-30 min in cities).

CRITICAL TIMING RULE: When a stop involves travel time (e.g. "2-hour drive"), the NEXT stop's start time must account for that travel time. If departure is 6:30 PM with a 2-hour drive, the next stop cannot start before 8:30 PM. Always calculate arrival times realistically. The duration field represents time SPENT at the stop, not travel time to the next stop. If a stop has a long duration like "2 hours" or includes driving (e.g. "pick up car, 2-hour drive"), add that full duration plus any travel time before scheduling the next stop.

RULES:
- Follow the STOP COUNT PER DAY rules above strictly. Do not add extra stops beyond what is specified.
- CROSS-DAY DEDUPLICATION (CRITICAL): NEVER recommend the same place on multiple days. Every stop across the entire trip must be unique. If Day 1 visits "Shibuya Crossing", no other day may include it. This applies to attractions, restaurants, AND backup options.
- Exactly 1 backupOption per restaurant and attraction. Omit backupOptions for hotel/transport/other.
- No place may appear as both a main stop and a backup option anywhere in the same itinerary.
- Descriptions: 1 sentence max. Name a signature dish, landmark feature, or unique highlight.
- Ratings: conservative estimates only. Assign 4.5+ only for widely acclaimed spots. Never 4.8+ unless world-famous.
- For non-US destinations: omit yelpRating and yelpReviewCount entirely.
- Theme parks and amusement parks (Disneyland, Universal Studios, SeaWorld, Legoland, Six Flags, etc.) should be scheduled as the ONLY major activity for that day. Do not schedule other attractions before or after a theme park visit on the same day.`

function buildSystemPrompt(_tier: Tier): string {
  return SYSTEM_PROMPT
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
    model: 'claude-sonnet-4-5-20250929',
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
    model: 'claude-sonnet-4-5-20250929',
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
