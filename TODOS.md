# Lulgo — TODOS

## Growth (current priority)

- [ ] **Reddit / 小紅書 posts** — Free growth channels. Post seed trip links with engaging copy. Validate product-market fit before paid channels.
- [ ] **Stripe Trip Pass $2.99** — Simple paywall to validate willingness to pay. Keep scope small.
- [ ] **App Store submission (May 2026)** — Needs Apple Developer account ($99) + Sign in with Apple integration.

## Phase B (deferred)

- [ ] **Integrate Yelp Fusion API** — Replace Claude-estimated Yelp ratings with live data. Requires Yelp developer account approval.
- [ ] **Migrate trip storage to Supabase** — Redis is fine for now but Supabase gives real database for future features (user accounts, trip history, search).

## Design (deferred from /design-review on main, 2026-03-27)

- [x] **[HIGH] Configure Upstash Redis env var** — Fixed. Redis is working in production with ioredis.
- [x] **[MEDIUM] Reduce emoji-as-design-element density** — Fixed by /design-review on main, 2026-03-28. Removed decorative ✨ from homepage H1, trip header, and footer. Removed 🅿️💡🔥📍 from PlaceCard. Kept functional type icons (🎡🍽️🏨🚗).
- [ ] **[MEDIUM] Semantic color naming for ratings** — PlaceCard uses raw `blue-200`/`red-200` for Google/Yelp. Define `--color-google` and `--color-yelp` in globals.css so a brand color update doesn't require grep-and-replace.

## From /autoplan review (2026-03-27)

- [x] **[CRITICAL] Fix `proxy.ts` (was misnamed `middleware.ts`)** — Next.js 16 uses `proxy.ts` / `export function proxy`. Fixed export name and made `Ratelimit` a module-level singleton.
- [x] **[CRITICAL] Configure Upstash KV before first Vercel deploy** — Fixed. Using ioredis with REDIS_URL in production.
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

## Completed (April 2026)

- [x] **SEO optimization** — Sitemap (218 pages), robots.txt, JSON-LD structured data, meta tags, OG images
- [x] **10 seed trips** — Tokyo, Seoul, Taipei, Bangkok, Singapore, Osaka, Bali, HK, London, Paris
- [x] **Collaborative editing hints** — Collab banner on trip page, share text with collab line, share panel hint
- [x] **Google Places API integration** — Restaurant validation, geocoding, route optimization
- [x] **Parallel generation** — 5+ day trips split into 2 parallel Claude calls
- [x] **Hero images** — Unsplash integration with attribution
- [x] **Export + Share** — URL copy, QR code, export text, collab hint in share text

## Ongoing

- [ ] **Monitor Claude API costs** — No user auth = potential abuse. Set up Anthropic usage alerts. Rate limit is 3 req/hour per IP but a determined bad actor could still run up costs across IPs.
