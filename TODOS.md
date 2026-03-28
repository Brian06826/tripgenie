# TripGenie — TODOS

## Pre-Phase A Launch (do these during the Phase A build)

- [ ] **Apply for Yelp Fusion API access** — Yelp requires manual approval (1-4 week turnaround). Apply now at developer.yelp.com to avoid delaying Phase B launch. Fills out a form (~15 min).

- [ ] **Define prompt engineering test baseline** — Before first deploy, generate 3 reference itineraries (Long Beach 一日遊, San Diego 5-day, SF 2-day) and save the outputs to `/tests/prompt-baselines/`. Future prompt changes get compared against these. Prevents silent quality regressions.

## Phase B (after 20+ real WeChat shares proven)

- [ ] **Integrate Google Places API** — Replace Claude-estimated Google ratings with live data. Need to enable Places API in Google Cloud Console and add `GOOGLE_PLACES_API_KEY` to Vercel env vars.

- [ ] **Integrate Yelp Fusion API** — Replace Claude-estimated Yelp ratings with live data. Requires approved Yelp developer account (see above TODO).

- [ ] **Migrate trip storage to Supabase** — Vercel KV is Upstash Redis. Fine for MVP but Supabase gives you a real database for Phase B features (user accounts, trip history, search). Plan the migration before KV is storing thousands of trips.

## Design (deferred from /design-review on main, 2026-03-27)

- [ ] **[HIGH] Configure Upstash Redis env var** — Trip page returns 500 because `TRIP_PREFIX` env var is missing or invalid. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local` to unblock the trip page entirely. (`lib/storage.ts:23`)
- [x] **[MEDIUM] Reduce emoji-as-design-element density** — Fixed by /design-review on main, 2026-03-28. Removed decorative ✨ from homepage H1, trip header, and footer. Removed 🅿️💡🔥📍 from PlaceCard. Kept functional type icons (🎡🍽️🏨🚗).
- [ ] **[MEDIUM] Semantic color naming for ratings** — PlaceCard uses raw `blue-200`/`red-200` for Google/Yelp. Define `--color-google` and `--color-yelp` in globals.css so a brand color update doesn't require grep-and-replace.

## From /autoplan review (2026-03-27)

- [x] **[CRITICAL] Fix `proxy.ts` (was misnamed `middleware.ts`)** — Next.js 16 uses `proxy.ts` / `export function proxy`. Fixed export name and made `Ratelimit` a module-level singleton.
- [ ] **[CRITICAL] Configure Upstash KV before first Vercel deploy** — File-based dev storage throws on Vercel read-only filesystem. Trips silently lost. Set `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
- [x] **[HIGH] Fix `og.tsx` day count** — Fixed in `lib/og.tsx` and `app/trip/[id]/page.tsx` (generateMetadata also had the bug).
- [x] **[HIGH] Fix `handleSwap` priceRange leak** — Added `priceRange: undefined` to overwrite list. `components/TripItinerary.tsx`
- [x] **[HIGH] Fix place key after swap** — Changed `key={placeIndex}` → `key={place.name}`. `components/TripItinerary.tsx`
- [x] **[MEDIUM] Remove `sticky top-14` from AlternativesPanel** — Removed. Also changed `md:` → `lg:` breakpoints to match TripItinerary grid.
- [x] **[MEDIUM] Wrap `getTrip` in React `cache()`** — Done. `lib/storage.ts`
- [x] **[MEDIUM] Make `Ratelimit` a module-level singleton in middleware** — Done as part of proxy.ts rename.
- [x] **[LOW] Delete `DayCard.tsx`** — Deleted.
- [ ] **[LOW] Add `parking?.details` null guard in PlaceCard** — Defensive; Zod validates but guard is cheap. `components/PlaceCard.tsx:52`
- [ ] **Phase B: Server-side swap persistence** — Swap currently not visible in shared link. Implement POST /api/swap that saves new trip variant with new nanoid.
- [ ] **Phase B: Swap disclosure copy** — Add "Swaps are personal — not visible in shared link" near Swap button or Share bar.

## Ongoing

- [ ] **Monitor Claude API costs** — No user auth = potential abuse. Set up Anthropic usage alerts. Rate limit is 3 req/hour per IP but a determined bad actor could still run up costs across IPs.
