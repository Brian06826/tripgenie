/**
 * Test script for ChatInput validation logic.
 * Mirrors isValidTripRequest() from components/ChatInput.tsx exactly.
 * Run: npx tsx scripts/test-validation.ts
 */

const NON_TRIP_PATTERNS = /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|yes|no|bye|goodbye|how are you|what is|what's|who is|who are|tell me a joke|help me with|write me|explain|define|translate this|calculate|what time|good morning|good night|test|testing|asdf|aaa)[\s!?.]*$/i

const NON_TRIP_LONG = /\b(essay|homework|write me|code|recipe|review this|explain the|history of|best countries|translate|summarize|who is the)\b/i

const TRIP_SIGNALS = /\b(go|going|want|wanna|plan|visit|trip|travel|fly|stay|from|to|day|days|night|nights|week|weeks|vacation|holiday|itinerary|tour|explore|weekend|getaway|beach|hotel|hostel|resort|budget|solo|couple|family|food|restaurant|sightseeing|backpack|honeymoon|anniversary|road\s?trip|airport|flight)\b/i
const TRIP_SIGNALS_ZH = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/

function isValidTripRequest(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  if (NON_TRIP_PATTERNS.test(trimmed)) return false
  if (NON_TRIP_LONG.test(trimmed)) return false
  if (TRIP_SIGNALS_ZH.test(trimmed)) return true
  if (TRIP_SIGNALS.test(trimmed)) return true
  if (/\d+\s*[-–\/]\s*\d+/.test(trimmed) || /\d+\s*(day|night|week|hour)/i.test(trimmed)) return true
  if (trimmed.length >= 30) return true
  return false
}

// --- Test cases ---

const shouldAccept: string[] = [
  "1 day Long Beach trip",
  "I wanna go to Japan from 3/4/26-3/8/26",
  "answer in traditional chinese. I wanna go to Japan from 3/4/26-3/8/26. I don't wanna see any temples or museum",
  "東京三日遊",
  "I want to visit Paris for 5 days with my girlfriend",
  "take me to hawaii, budget friendly, with kids",
  "SF weekend trip, no museums",
  "3天台北美食之旅",
  "Anchorage Alaska 2 days solo trip",
  "I don't want temples. 5 days Japan trip",
  "romantic getaway to Santorini",
  "我想去北海道5天",
  "bring me somewhere fun for 3 days",
  "plan a trip to Thailand",
  "going to NYC next week",
  "长滩一日游",
  "family trip to Orlando with SeaWorld",
  "2 weeks Europe backpacking",
  "honeymoon in Maldives",
  "road trip from LA to Vegas",
  // Long customer-style inputs
  "Me and my wife are celebrating our 10th anniversary, we want to go somewhere nice in Europe for about a week, preferably somewhere with good food and nice views",
  "I'm taking my parents who are in their 70s to Japan for the first time, they can't walk too much, 5 days",
  "hey can you plan something for me and 3 friends, we're thinking maybe Thailand or Vietnam, around 4-5 days, we like nightlife and street food",
  "我同女朋友想去台北玩四日三夜，想食多啲夜市小食，唔想去太多寺廟",
  "looking for a chill beach vacation, maybe Bali or Phuket, nothing too touristy, 1 week with my boyfriend",
  "我下個月要帶小朋友去東京迪士尼，順便去淺草同新宿，大概5日4夜",
  "we have a conference in San Francisco on Monday and want to explore the city for 2 extra days after, what should we do",
  "I want to go somewhere cold in December, maybe Iceland or Norway, solo trip, about 6 days, I love nature and photography",
  "please help me plan a trip. I am going to Korea with my college friends. We are 6 people. 7 days. We like shopping, food, and nightlife. Budget is medium.",
  "my budget is tight but I really want to visit New York for 3 days, can you make an affordable itinerary with free activities",
]

const shouldReject: string[] = [
  "hello",
  "how are you",
  "what is the weather",
  "tell me a joke",
  "who is the president",
  "",
  "hi",
  "good morning",
  "thanks",
  "ok",
  "help me with",
  "what is AI",
  "calculate 2+2",
  "translate this",
  // Long non-trip inputs
  "can you write me an essay about travel",
  "what are the best countries to visit",
  "explain the history of Japan",
  "I need help with my homework",
  "review this restaurant for me",
]

// --- Run tests ---

let passed = 0
let failed = 0
const failures: string[] = []

console.log("=== SHOULD ACCEPT ===\n")
for (const input of shouldAccept) {
  const result = isValidTripRequest(input)
  const label = result ? "PASS ✅" : "FAIL ❌"
  if (!result) { failed++; failures.push(`ACCEPT "${input}" → rejected`) } else { passed++ }
  console.log(`  ${label}  "${input.length > 60 ? input.slice(0, 57) + '...' : input}"`)
}

console.log("\n=== SHOULD REJECT ===\n")
for (const input of shouldReject) {
  const result = isValidTripRequest(input)
  const label = !result ? "PASS ✅" : "FAIL ❌"
  if (result) { failed++; failures.push(`REJECT "${input}" → accepted`) } else { passed++ }
  console.log(`  ${label}  "${input || '(empty)'}"`)
}

console.log(`\n${"=".repeat(50)}`)
console.log(`TOTAL: ${passed + failed} tests | ${passed} passed | ${failed} failed`)
if (failures.length > 0) {
  console.log(`\nFAILURES:`)
  for (const f of failures) console.log(`  ❌ ${f}`)
}
console.log()
