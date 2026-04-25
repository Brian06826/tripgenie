import Anthropic from '@anthropic-ai/sdk'
import { TripGenerationSchema, type TripGeneration } from './types'

// Progress events emitted during trip generation
export type GenerationProgress =
  | { type: 'chunk' }
  | { type: 'day'; dayNumber: number; totalDays: number }

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

const SYSTEM_PROMPT = `You are Lulgo, an AI trip planner. Respond ONLY with valid JSON — no markdown, no explanation, no text outside the JSON object.

RULE PRIORITY (when rules conflict): User-specified constraints > Meal timing > Geographic flow > Daily schedule > Stop count > Iconic attractions.

GEOGRAPHIC CONSTRAINT (CRITICAL): Every place you recommend MUST be physically located WITHIN the destination city or its immediate vicinity (within 5 miles). NEVER recommend a place in a different city. Before including any place, verify: is this place actually in the destination? If unsure, choose a different place that you know is local.

MULTI-CITY / REGION TRIPS: If the user requests a region (e.g. "Southeast Asia", "Europe", "Japan"), pick the most logical cities and split the trip across them, allocating 2-3 days per city. Set "destination" to the region name. For example, "2 weeks Southeast Asia" → Bangkok (3 days) → Chiang Mai (2 days) → Hanoi (3 days) → Ho Chi Minh City (2 days) → Siem Reap (3 days). Include inter-city transport as type "transport" stops between cities. Within each city segment, the geographic constraint applies — all stops must be in THAT city.

PLACE QUALITY FILTER: NEVER list infrastructure, transport facilities, or mundane urban features as attractions. This includes: escalators (e.g. Central-Mid-Levels Escalator), pedestrian bridges, MTR/subway stations, bus terminals, parking garages, highway rest stops, or public restrooms. These are transit tools, not destinations. Only include a place as an attraction if a tourist would specifically travel there to see it or experience it.

ANTI-HALLUCINATION: Only recommend restaurants and shops you are CONFIDENT currently exist and are open for business. Prefer places with high ratings on Google (4.0+) or Yelp (4+ stars) with many reviews (200+). Recommend popular local favorites that real people actually review and visit, not chain restaurants. If a famous restaurant or shop has closed, relocated, or rebranded in recent years, DO NOT include it — choose a currently operating alternative instead. It is better to recommend fewer places than to include a closed or fake one.

LANGUAGE: Detect language ONLY by the CHARACTER SCRIPT of the user's input — not by destination names, place names, or topic.
- All Latin/ASCII characters (a-z, A-Z) → English. Set "language": "en". Respond in English.
- Contains Traditional Chinese characters (繁體字) → Traditional Chinese. Set "language": "zh-TW".
- Contains Simplified Chinese characters (简体字) → Simplified Chinese. Set "language": "zh-CN".
- Contains Cantonese-specific phrasing with Traditional characters → Set "language": "zh-HK".
- If mixed scripts, use whichever script has MORE characters.
- If the user explicitly requests a language, always honor that request.
CRITICAL: "hong kong", "tokyo", "taipei" written in Latin letters = English input. Do NOT switch to Chinese just because the destination is in Asia. The script of the INPUT text determines the language, not the destination.
ALL descriptive text (titles, descriptions, tips) must be in the detected language. Place names: always include both "name" (English/romanized) and "nameLocal" (local script) when both exist.

DATE AWARENESS: If the user mentions specific dates (e.g. "April 5-7", "4月5日", "next Friday", "this weekend"), extract the start date and include it as "startDate" in YYYY-MM-DD format. If the user says relative dates like "next week" or "this Saturday", calculate the actual date based on today being ${new Date().toISOString().split('T')[0]}. If no date is mentioned, omit the startDate field.

JSON schema:
{
  "title": "string",
  "destination": "string",
  "startDate": "string (optional, YYYY-MM-DD format)",
  "language": "en|zh-TW|zh-HK|zh-CN",
  "days": [{
    "dayNumber": 1,
    "title": "string (generic theme like 'City Exploration', 'Coastal Day', 'Culture & History' — NEVER include specific place names or district names in the title)",
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
- "budget" / "cheap" / "$" / "tight budget" → ONLY $ restaurants (street food, hawker stalls, food courts, local diners). NEVER recommend Michelin-starred, award-winning, or famous expensive restaurants (e.g. Jay Fai, Gaggan). Free attractions, street food markets, budget-friendly activities only.
- "luxury" / "upscale" / "$$$$" → fine dining, premium experiences
- "food-focused" / "foodie" → more restaurants, food markets, culinary experiences
- "nightlife" → include evening bars, live music, late-night spots
- "nature" / "outdoors" → parks, hikes, beaches, scenic viewpoints

STOP COUNT PER DAY (CRITICAL):
- 1-day trip: 5 stops (6 in compact cities). Structure: morning attraction → lunch → 2 afternoon attractions → dinner.
- 2+ day trips: 4-5 stops per day. Structure: morning attraction → lunch → 1-2 afternoon attractions → dinner.
- ABSOLUTE MINIMUM: Every full day MUST have at least 4 places (including meals). A day with fewer than 4 places is INVALID — add more local attractions, cafes, markets, or parks to fill it. If you cannot think of famous spots, include well-rated local favorites or hidden gems.
- "relaxed" / "chill": reduce by 1 stop, longer durations. Still include lunch AND dinner.
- "packed" / "maximize": add 1-2 extra stops. Include lunch AND dinner.
- "morning only" / "半日" / "half day": plan until ~1:00 PM. 2-3 stops + lunch. No dinner.
- User-specified times (e.g. "9am-3pm"): respect EXACTLY. Only include meals that fall within those hours.
- Transport stops (departure/return) do NOT count toward the stop count above.
- COMPACT CITIES (Tokyo, Taipei, Hong Kong, Singapore, Manhattan, London, Paris, Barcelona, Amsterdam): add 1 extra stop per day. For spread-out cities (LA, Houston, Dallas), keep standard count.
- BEACH/RESORT destinations (Bali, Maldives, Hawaii, Phuket, Cancun, Koh Samui): default to relaxed pace (3-4 stops/day). Include free time for beach, pool, or spa — not every moment needs a scheduled activity.
- ROAD TRIP destinations (Iceland, New Zealand, Scottish Highlands, Norway, Route 66): plan stops linearly along the driving route. 3-4 stops per day to account for long drives. Include driving time in tips. If no restaurants nearby, suggest packed lunch. RETURN JOURNEY: if the trip must end where it started (e.g. returning a rental car), the return drive MUST be realistic. If the return drive exceeds 4 hours, dedicate the last day primarily to driving back with at most 1-2 brief stops along the route. NEVER schedule a full day of sightseeing 8+ hours from the starting city on the last day.

ICONIC ATTRACTIONS (CRITICAL — NEVER VIOLATE): Iconic attractions MUST be scheduled as MAIN STOPS, never as alternatives or backup options. If the destination's #1 most famous attraction (the one a first-time visitor would regret missing most) is missing from main stops, the itinerary is INVALID. Examples: Taipei → 故宮/National Palace Museum MUST be a main stop, Tokyo → Senso-ji or Shibuya Crossing, Paris → Eiffel Tower or Louvre, NYC → Central Park or Statue of Liberty. Spread top icons across different days for 3+ day trips — do not cluster them all on Day 1.

DAILY SCHEDULE RULES (CRITICAL):
1. DEFAULT full-day: 9:00 AM to 9:00 PM. Must include BOTH lunch AND dinner. NEVER end before 6:00 PM.
2. Space activities naturally throughout the day. Morning: 9:00 AM-12:00 PM. Afternoon: 1:30 PM-5:30 PM. Evening: 6:00 PM onward.
3. 15-30 min buffer between stops. NEVER leave >90 min unscheduled gaps — if a gap appears, fill it with a nearby attraction, market, park, or shopping area.
4. Every full non-arrival day MUST have a morning attraction starting before 11:00 AM. NEVER start a day's first activity after noon unless the user explicitly requested a late start.

GEOGRAPHIC FLOW: Plan each day's stops in a logical geographic route — move through the city in one direction, grouping nearby stops together. NEVER backtrack to an earlier area for a later stop. Dinner MUST be reachable within 30 min transit from the last afternoon stop — NEVER schedule dinner in a completely different district requiring >30 min transit. If the last stop is remote (e.g. Tai O in Hong Kong, Kamakura from Tokyo, outer islands), eat dinner IN that area or along the return route. When recommending chain restaurants, choose the branch closest to that day's activity cluster.

OPENING HOURS AWARENESS (CRITICAL): Schedule attractions during their likely open hours. Museums and galleries: usually 10:00 AM - 5:00 PM (skip Monday — many are closed). Night markets (夜市) NEVER before 5:00 PM — they open at 5-6 PM. Scheduling a night market at 3:00 PM or 4:00 PM is WRONG. Temples and religious sites: open early morning, close by 5:00-6:00 PM — NEVER schedule a temple visit after 6:00 PM. Parks and gardens: close at dusk (5:00-6:30 PM depending on season) — NEVER schedule after dark. Shopping malls: 10:00 AM - 10:00 PM. Fixed-time events (light shows, fireworks, performances): arrive 15 min before start time and include "confirm exact timing before visiting" in tips. If unsure about opening hours, schedule for 10:00 AM - 5:00 PM as a safe window. NEVER schedule any attraction after 9:00 PM — only restaurants, bars, and night markets can be visited that late.

STRICT MEAL TIMING (CRITICAL — NEVER VIOLATE — MEALS ARE HIGHER PRIORITY THAN ATTRACTIONS):
- Breakfast/Brunch: 8:00-10:00 AM. Include ONLY when: (1) user explicitly asks for breakfast, (2) the destination is famous for breakfast culture (e.g. dim sum in Hong Kong, morning market in Taipei), or (3) a multi-day trip where starting with breakfast makes the day flow better. Do NOT add breakfast by default for 1-day trips.
- Lunch: 11:30 AM - 1:00 PM. REQUIRED for every full day. Must be a proper meal (not just a snack or dessert). Street food stalls, hawker centers, night markets, and local eateries count as meals if they serve full dishes (rice, noodles, soup, etc.). Do NOT schedule dessert shops, ice cream parlors, or bubble tea shops as lunch.
- Dinner: 6:00-8:30 PM. REQUIRED for every full day. Same meal rule as lunch. NEVER schedule dinner before 5:30 PM or after 9:00 PM. A dinner at 4:00 PM, 5:00 PM, or 10:00 PM is WRONG. If you run out of afternoon activities, add a relaxation break, park visit, or shopping time to fill until 6:00 PM.
- Do NOT add afternoon snack/cafe/dessert stops unless the user specifically asks for them.
- NEVER schedule two full meals (restaurant type stops) within 2 hours of each other.
- Each full day (9 AM-9 PM range) MUST have exactly one lunch restaurant AND one dinner restaurant. This is a HARD RULE, not a guideline. A day without both lunch and dinner is INVALID.
- IF TIME IS TIGHT: shorten attraction durations (e.g. 2 hours → 1 hour) or remove an attraction. NEVER skip or remove a meal to save time. Meals are non-negotiable.

POST-DINNER ACTIVITIES (8:00 PM - 9:30 PM max):
- "Nightlife" → bar, live music, or night market. "Relaxed" or "With Kids" → skip, end at dinner.
- "Foodie" → dessert or late-night snack. "Romantic" → scenic night walk or rooftop bar.
- Default (no chip): ONE optional light activity near the dinner spot (evening stroll, waterfront). Mark as "Optional".
- Night-scene cities (Tokyo, Taipei, NYC, Las Vegas, Bangkok): lean towards adding a night activity.
- Keep it short (30-60 min) and close to dinner (walking distance).

SELF-CHECK (MANDATORY — run after generating the full itinerary):
Before returning your JSON, verify EVERY full day has:
1. Exactly one restaurant-type stop between 11:30 AM - 1:00 PM (lunch)
2. Exactly one restaurant-type stop between 5:30 PM - 8:00 PM (dinner)
3. No dinner scheduled before 5:30 PM
4. No place appears on multiple days (cross-day deduplication)
5. No place appears as both a main stop AND a backup option anywhere
6. No gap >90 min between consecutive stops (fill with nearby activity if needed)
7. Sunset-worthy spots (beaches, cliffs, viewpoints, waterfronts, anything with "sunset" in its name) are scheduled for 5:00-7:00 PM to catch golden hour — NEVER before 4:30 PM
8. The destination's #1 most famous attraction appears as a main stop (not backup) somewhere in the trip
9. Each day's title uses a generic theme (e.g. "Old Town & Local Eats", "Nature Day") — no specific place names or district names in day titles
10. No arrivalTime is after 9:30 PM. If any is, clamp it: restaurants/bars → 8:00 PM, hotels → 9:00 PM, attractions/temples/parks → 5:00 PM. NEVER schedule a temple, park, or museum after 6:00 PM
11. Night markets are scheduled at 5:00 PM or later — NEVER before 5:00 PM
12. Road trip last day: if return drive >4 hours, last day is primarily a travel day
13. No infrastructure/transport (escalators, bridges, MTR stations) listed as attractions
14. Every attraction is scheduled within its plausible opening hours (temples before 6 PM, museums before 5 PM, parks before dusk)
If any day fails these checks, fix it before responding. Add a missing meal, move a misplaced one, swap a duplicate, or fill a gap.

TRANSPORTATION & MEETING POINTS:
- If the user mentions a departure point (e.g. "I take metro from Glendora to downtown"), include that as the FIRST stop with type "transport", with the estimated transit time as duration.
- If the user mentions how they're getting there (e.g. "my girlfriend drives to downtown"), acknowledge it and start the itinerary from that arrival point.
- If the user mentions a specific transport mode (metro, train, bus, driving), use that mode for travel time estimates throughout the day and mention it in tips.
- If the user mentions meeting someone at a location, start the itinerary from that meeting point.
- For US cities, assume visitors will drive between stops unless they specify otherwise.
- For transit cities (Tokyo, Osaka, Seoul, Hong Kong, Taipei, Singapore, London, Paris, Berlin, New York, San Francisco, Chicago, Boston), recommend specific transit lines/routes in tips (e.g. "Take the JR Yamanote Line to Shibuya Station"). Only mention a specific station name if you are CONFIDENT it is the correct nearest station — if unsure, say "nearest metro station" or "check Google Maps for directions" instead.
- For taxi-dependent destinations (Bali, Phuket, Cancun, Dubai, Vietnam, Chiang Mai, Marrakech, Siem Reap), suggest Grab/taxi in tips and note approximate ride time between stops.
- Group nearby stops together to minimize travel time.
- RETURN TRIP (CRITICAL ORDERING RULE): If the user mentions ANY of these, include a return trip as the ABSOLUTE LAST stop of the last day (type "transport"): departure point, transport method, "back to airport", "return to airport", "flight at [time]", "fly back", "catch a flight", or a specific departure time on the last day (e.g. "6pm last day"). Order: activities → dinner → return trip. NEVER place any activity after the return trip. If the user specifies a departure time, work backward from that time to schedule the day. Match the same transport mode they used to arrive.

TIME & ARRIVAL AWARENESS: Respect any user-specified start/end times exactly — never schedule stops outside them. If user mentions arriving late ("landing at 2pm") or leaving early ("flight at 8pm"), adjust that day's schedule with buffer time. "Start late" / "sleep in" / "晚啲出發" → begin at their requested time (or 10:00 AM default), fewer stops but still include lunch AND dinner. For multi-day trips: Day 1 can start later, last day can end earlier, middle days use full schedule.

TIMING RULE: The duration field = time SPENT at the stop, not travel to the next. When calculating the next stop's start time, add current stop's duration + travel time. Always calculate arrival times realistically.

RULES:
- CROSS-DAY DEDUPLICATION (CRITICAL): NEVER recommend the same place on multiple days. Every stop across the entire trip must be unique. If Day 1 visits "Shibuya Crossing", no other day may include it. This applies to attractions, restaurants, AND backup options.
- Exactly 1 backupOption per restaurant and attraction. Omit backupOptions for hotel/transport/other.
- No place may appear as both a main stop and a backup option anywhere in the same itinerary.
- Tips must not suggest activities that conflict with scheduled timing. If recommending a timed event in tips (light show, sunset, performance), either schedule it as a proper stop OR ensure surrounding stops have enough time to accommodate it.
- Descriptions: 1 sentence max. Name a signature dish, landmark feature, or unique highlight.
- Ratings: conservative estimates only. Assign 4.5+ only for widely acclaimed spots. Never 4.8+ unless world-famous.
- For non-US destinations: omit yelpRating and yelpReviewCount entirely.
- Full-day theme parks (Disneyland, Universal Studios, Six Flags, Legoland) should be the ONLY major activity for that day.
- REALISTIC DURATIONS by venue size: Large zoos/aquariums (San Diego Zoo, Singapore Zoo, Osaka Aquarium, etc.): 4-5 hours. Major museums (Louvre, British Museum, National Palace Museum, Met, etc.): 3-4 hours. National/state parks with trails: 3-4 hours. Small museums/temples: 1-1.5 hours. Street markets/shopping areas: 1.5-2 hours. Beaches: 2-3 hours. NEVER allocate less than 3 hours for a world-class zoo, aquarium, or major museum.`

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

// Post-processing: remove cross-day duplicate places (main stops AND backup options)
export function deduplicatePlaces(trip: TripGeneration): TripGeneration {
  // Normalize: lowercase, strip parenthetical (Shibuya Branch), (本店), trailing branch/location info
  function normalize(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s*[\(（].*?[\)）]\s*/g, '')
      .replace(/\s*[-–—]\s*(main|branch|store|shop|outlet|honten|本店)\s*$/i, '')
      .trim()
  }

  // Check if two normalized names refer to the same place
  // Exact match OR prefix match when shorter name ≥ 6 chars
  // Catches: "Ichiran" vs "Ichiran Ramen", "Ichiran Ramen" vs "Ichiran Ramen Shibuya"
  function isSameName(a: string, b: string): boolean {
    if (a === b) return true
    if (a.length >= 6 && b.startsWith(a)) return true
    if (b.length >= 6 && a.startsWith(b)) return true
    // Chain restaurant detection: same brand, different branch/location
    // "ichiran shibuya" vs "ichiran ramen dotonbori" — both start with "ichiran"
    // Compare first word (brand) when it's long enough to be meaningful
    const aWords = a.split(/\s+/)
    const bWords = b.split(/\s+/)
    if (aWords.length >= 2 && bWords.length >= 2) {
      // Check if dropping the last word from each yields matching or prefix-matching bases
      const aBase = aWords.slice(0, -1).join(' ')
      const bBase = bWords.slice(0, -1).join(' ')
      if (aBase.length >= 5 && bBase.length >= 5) {
        if (aBase === bBase) return true
        if (aBase.startsWith(bBase) || bBase.startsWith(aBase)) return true
      }
      // Also check: same first word when it's a known brand name (≥5 chars)
      if (aWords[0] === bWords[0] && aWords[0].length >= 5) return true
    }
    return false
  }

  const seenKeys: string[] = []

  function isDuplicate(name: string): boolean {
    const key = normalize(name)
    return seenKeys.some(existing => isSameName(key, existing))
  }

  function addSeen(name: string) {
    seenKeys.push(normalize(name))
  }

  const MIN_PLACES_PER_DAY = 3

  const updatedDays = trip.days.map(day => {
    // Phase 1: filter duplicates, promoting a backup option as replacement when possible
    let nonDupCount = 0
    const dedupedPlaces = day.places.reduce<typeof day.places>((acc, place) => {
      if (isDuplicate(place.name)) {
        // Try to replace with a non-duplicate backup option
        const replacement = place.backupOptions?.find(b => !isDuplicate(b.name))
        if (replacement) {
          console.warn(`[dedup] Replaced duplicate "${place.name}" with backup "${replacement.name}" on day ${day.dayNumber}`)
          addSeen(replacement.name)
          nonDupCount++
          const remainingBackups = place.backupOptions!.filter(b => b !== replacement)
          acc.push({ ...place, name: replacement.name, nameLocal: undefined, description: replacement.description, backupOptions: remainingBackups.length ? remainingBackups : undefined })
        } else if (nonDupCount + (day.places.length - acc.length - 1) < MIN_PLACES_PER_DAY) {
          // Keep the duplicate rather than leaving the day with too few places
          console.warn(`[dedup] Keeping duplicate "${place.name}" on day ${day.dayNumber} to maintain minimum places`)
          addSeen(place.name)
          nonDupCount++
          acc.push(place)
        } else {
          console.warn(`[dedup] Removed duplicate place: ${place.name} on day ${day.dayNumber}`)
        }
      } else {
        addSeen(place.name)
        nonDupCount++
        acc.push(place)
      }
      return acc
    }, [])

    // Phase 2: dedup backup options against all seen names
    const places = dedupedPlaces.map(place => {
      if (!place.backupOptions?.length) return place
      const filtered = place.backupOptions.filter(backup => {
        if (isDuplicate(backup.name)) {
          console.warn(`[dedup] Removed duplicate backup: ${backup.name} on day ${day.dayNumber}`)
          return false
        }
        addSeen(backup.name)
        return true
      })
      return filtered.length === place.backupOptions.length
        ? place
        : { ...place, backupOptions: filtered.length ? filtered : undefined }
    })

    return { ...day, places }
  })
  return { ...trip, days: updatedDays }
}

// ---------------------------------------------------------------------------
// Single-shot generation (1-4 day trips)
// ---------------------------------------------------------------------------

async function generateTripSingle(userPrompt: string, onProgress?: (event: GenerationProgress) => void): Promise<TripGeneration> {
  const days = detectTripDays(userPrompt)
  const tier = getTier(days)
  const systemPrompt = buildSystemPrompt(tier)
  const maxTokens = getMaxTokens(tier)

  let firstParsed: unknown
  let truncated = false
  let wasRefusal = false

  try {
    const { parsed, wasTruncated, wasRefusal: refusal } = onProgress
      ? await callClaudeStreaming(userPrompt, systemPrompt, maxTokens, onProgress, days)
      : await callClaude(userPrompt, systemPrompt, maxTokens)
    firstParsed = parsed
    truncated = wasTruncated
    wasRefusal = refusal
  } catch (err) {
    console.error('Attempt 1 parse error:', err)
    try {
      const { parsed } = await callClaude(buildConciseRetryPrompt(userPrompt), systemPrompt, maxTokens)
      const r = TripGenerationSchema.safeParse(parsed)
      if (r.success) return deduplicatePlaces(r.data)
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
      if (r.success) return deduplicatePlaces(r.data)
    } catch {
      // fall through
    }
    throw new Error(`Unable to generate itinerary for this destination. Please try rephrasing your request.`)
  }

  const firstResult = TripGenerationSchema.safeParse(firstParsed)
  if (firstResult.success) return deduplicatePlaces(firstResult.data)

  const retryPrompt = truncated
    ? buildConciseRetryPrompt(userPrompt)
    : buildRetryPrompt(userPrompt, JSON.stringify(firstResult.error.issues.map(e => ({
        path: e.path.map(String).join('.'),
        message: e.message,
      }))))

  try {
    const { parsed: retryParsed } = await callClaude(retryPrompt, systemPrompt, maxTokens)
    const retryResult = TripGenerationSchema.safeParse(retryParsed)
    if (retryResult.success) return deduplicatePlaces(retryResult.data)
    throw new Error(`Validation failed: ${JSON.stringify(retryResult.error.issues)}`)
  } catch {
    throw new Error(`Unable to generate itinerary. Please try again or rephrase your request.`)
  }
}

// ---------------------------------------------------------------------------
// Parallel generation (5+ day trips) — splits into two concurrent Claude calls
// ---------------------------------------------------------------------------

function buildPartialPrompt(
  userPrompt: string,
  totalDays: number,
  startDay: number,
  endDay: number,
  isSecondHalf: boolean,
): string {
  const partLabel = `days ${startDay}-${endDay} of a ${totalDays}-day trip`
  const dedupNote = isSecondHalf
    ? `\nIMPORTANT: This is the second half of the trip. Avoid repeating any popular/famous restaurants or attractions that would typically appear in the first ${startDay - 1} days. Choose DIFFERENT restaurants and attractions for variety.`
    : ''

  return `${userPrompt}

PARTIAL GENERATION INSTRUCTION: Generate ONLY ${partLabel}. Start dayNumber at ${startDay} and end at ${endDay}. Include all required fields (title, destination, language, days). The trip title and destination should reflect the FULL trip, not just this part.${dedupNote}`
}

async function generateTripParallel(userPrompt: string, onProgress?: (event: GenerationProgress) => void): Promise<TripGeneration> {
  const days = detectTripDays(userPrompt)
  const systemPrompt = buildSystemPrompt(3) // Always tier 3 for 5+ days
  const splitDay = Math.ceil(days / 2) // e.g. 7 days → split at 4 (days 1-4 + 5-7)

  // Each half gets 8000 tokens (more than enough for 3-4 days)
  const maxTokensPart = 8000

  console.log(`[parallel] Splitting ${days}-day trip: days 1-${splitDay} + days ${splitDay + 1}-${days}`)

  const prompt1 = buildPartialPrompt(userPrompt, days, 1, splitDay, false)
  const prompt2 = buildPartialPrompt(userPrompt, days, splitDay + 1, days, true)

  // Run both calls in parallel
  const [result1, result2] = await Promise.all([
    (async () => {
      try {
        const { parsed, wasTruncated, wasRefusal } = onProgress
          ? await callClaudeStreaming(prompt1, systemPrompt, maxTokensPart, onProgress, days)
          : await callClaude(prompt1, systemPrompt, maxTokensPart)
        if (wasRefusal) throw new Error('Claude refused part 1')
        if (wasTruncated) {
          // Retry with concise prompt
          const { parsed: retryParsed } = await callClaude(buildConciseRetryPrompt(prompt1), systemPrompt, maxTokensPart)
          return retryParsed
        }
        return parsed
      } catch (err) {
        console.error('[parallel] Part 1 failed:', err)
        throw err
      }
    })(),
    (async () => {
      try {
        // Part 2 uses non-streaming (no need for double heartbeats)
        const { parsed, wasTruncated, wasRefusal } = await callClaude(prompt2, systemPrompt, maxTokensPart)
        if (wasRefusal) throw new Error('Claude refused part 2')
        if (wasTruncated) {
          const { parsed: retryParsed } = await callClaude(buildConciseRetryPrompt(prompt2), systemPrompt, maxTokensPart)
          return retryParsed
        }
        return parsed
      } catch (err) {
        console.error('[parallel] Part 2 failed:', err)
        throw err
      }
    })(),
  ])

  // Validate each part
  const part1 = TripGenerationSchema.safeParse(result1)
  const part2 = TripGenerationSchema.safeParse(result2)

  if (!part1.success) {
    console.error('[parallel] Part 1 validation failed:', part1.error.issues)
    throw new Error('Unable to generate itinerary. Please try again.')
  }
  if (!part2.success) {
    console.error('[parallel] Part 2 validation failed:', part2.error.issues)
    throw new Error('Unable to generate itinerary. Please try again.')
  }

  // Merge: use part 1's metadata (title, destination, language) + combine days
  const merged: TripGeneration = {
    title: part1.data.title,
    destination: part1.data.destination,
    language: part1.data.language,
    startDate: part1.data.startDate,
    days: [...part1.data.days, ...part2.data.days],
  }

  console.log(`[parallel] Merged: ${merged.days.length} days (${part1.data.days.length} + ${part2.data.days.length})`)

  return deduplicatePlaces(merged)
}

// ---------------------------------------------------------------------------
// Post-generation safety net: backfill days with too few places
// ---------------------------------------------------------------------------

const MIN_PLACES_BACKFILL = 4

/**
 * Check each day for minimum places. If any day is under the threshold,
 * call Claude to generate additional places for just that day.
 */
export async function backfillSpareDays(trip: TripGeneration): Promise<TripGeneration> {
  const spareDays = trip.days.filter(d => d.places.length < MIN_PLACES_BACKFILL)
  if (spareDays.length === 0) return trip

  console.log(`[backfill] ${spareDays.length} day(s) under ${MIN_PLACES_BACKFILL} places: ${spareDays.map(d => `Day ${d.dayNumber} (${d.places.length})`).join(', ')}`)

  const systemPrompt = buildSystemPrompt(1)

  // Collect all existing place names across the trip to avoid duplicates
  const allNames = trip.days.flatMap(d => d.places.map(p => p.name)).join(', ')

  const out: TripGeneration = JSON.parse(JSON.stringify(trip))

  for (const day of spareDays) {
    const needed = MIN_PLACES_BACKFILL - day.places.length
    const existingNames = day.places.map(p => p.name).join(', ')
    const existingTimes = day.places.map(p => `${p.name} at ${p.arrivalTime || 'unknown'}`).join(', ')

    const prompt = `Generate EXACTLY ${needed} additional place(s) for Day ${day.dayNumber} of a trip to ${trip.destination}.

EXISTING places for this day: ${existingTimes}
ALL places already in the full trip (DO NOT repeat ANY): ${allNames}

Requirements:
- Add ${needed} new place(s) that fit naturally into Day ${day.dayNumber} "${day.title}"
- Fill time gaps in the existing schedule (look at existing arrivalTimes)
- Ensure the day has both lunch (11:30 AM - 1:00 PM) and dinner (5:30 - 8:00 PM) if missing
- Include: name, nameLocal (if applicable), type, description (1 sentence), arrivalTime, duration, googleRating, tips, priceRange (restaurants only), backupOptions (1 per restaurant/attraction)
- Places must be real, well-known, and physically located in ${trip.destination}
- Language: ${trip.language}

Return ONLY a JSON array of the new place objects. Example: [{"name": "...", "type": "attraction", ...}]`

    try {
      const { parsed } = await callClaude(prompt, systemPrompt, 4000)
      const newPlaces = Array.isArray(parsed) ? parsed : []
      if (newPlaces.length > 0) {
        const targetDay = out.days.find(d => d.dayNumber === day.dayNumber)
        if (targetDay) {
          targetDay.places.push(...newPlaces)
          console.log(`[backfill] Added ${newPlaces.length} place(s) to Day ${day.dayNumber}: ${newPlaces.map((p: any) => p.name).join(', ')}`)
        }
      } else {
        console.warn(`[backfill] No valid places returned for Day ${day.dayNumber}`)
      }
    } catch (err) {
      console.error(`[backfill] Failed to backfill Day ${day.dayNumber}:`, err)
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Public API — routes to single or parallel based on trip length
// ---------------------------------------------------------------------------

export async function generateTrip(userPrompt: string, language?: string, onProgress?: (event: GenerationProgress) => void): Promise<TripGeneration> {
  const validation = validateTripRequest(userPrompt)
  if (!validation.valid) throw new Error(validation.message)

  // Append explicit language override if the user selected a UI locale
  const langSuffix = language === 'zh-CN'
    ? '\n\n[LANGUAGE OVERRIDE: The user selected Simplified Chinese (简体中文). You MUST set "language": "zh-CN" and write ALL text (title, descriptions, tips, day titles) in Simplified Chinese characters (简体字). Do NOT use Traditional Chinese characters.]'
    : language === 'zh-TW'
    ? '\n\n[LANGUAGE OVERRIDE: The user selected Traditional Chinese (繁體中文). You MUST set "language": "zh-TW" and write ALL text (title, descriptions, tips, day titles) in Traditional Chinese characters (繁體字). Do NOT use Simplified Chinese characters.]'
    : ''
  const prompt = langSuffix ? userPrompt + langSuffix : userPrompt

  const days = detectTripDays(userPrompt)

  // 5+ day trips: parallel generation for ~40-50% speedup
  if (days >= 5) {
    try {
      return await generateTripParallel(prompt, onProgress)
    } catch (err) {
      console.warn('[parallel] Parallel generation failed, falling back to single:', err)
      // Fall back to single-shot if parallel fails
    }
  }

  return generateTripSingle(prompt, onProgress)
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

async function callClaudeStreaming(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  onProgress: (event: GenerationProgress) => void,
  totalDays?: number,
): Promise<{ parsed: unknown; wasTruncated: boolean; wasRefusal: boolean }> {
  const stream = getClient().messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  let fullText = ''
  let tokenCount = 0
  let lastDetectedDay = 0
  stream.on('text', (text: string) => {
    fullText += text
    // Emit heartbeat every 20 tokens — enough to keep the SSE connection alive
    if (++tokenCount % 20 === 0) onProgress({ type: 'chunk' })

    // Detect "dayNumber": N in streaming JSON to report day-level progress
    if (totalDays) {
      const re = /"dayNumber"\s*:\s*(\d+)/g
      let m, latestDay = 0
      while ((m = re.exec(fullText)) !== null) latestDay = parseInt(m[1])
      if (latestDay > lastDetectedDay && latestDay <= totalDays) {
        lastDetectedDay = latestDay
        onProgress({ type: 'day', dayNumber: latestDay, totalDays })
      }
    }
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
