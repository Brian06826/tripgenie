Always respond in Traditional Chinese (繁體中文/廣東話).

@AGENTS.md

## Product

Lulgo (lulgo.com) — AI 旅行行程生成器。用戶輸入自然語言 → Claude 生成結構化 JSON → Next.js 渲染可編輯、可分享嘅行程頁面。

目標用戶：想快速規劃旅行嘅人，特別係亞洲目的地。
Growth loop：每個分享出去嘅 trip link 都係免費 marketing（協作編輯 = viral hook）。

## Tech Stack

- Next.js 16.2.1 (App Router, Turbopack)
- React 19, TypeScript
- Tailwind CSS
- Claude claude-sonnet-4-20250514 (Anthropic API) for trip generation
- Redis (ioredis) for trip storage, 90-day TTL
- NextAuth for optional auth
- Vercel deployment
- Google Places API for restaurant validation + geocoding
- Unsplash API for hero images

## Architecture

```
User prompt → /api/generate (SSE stream)
  → lib/claude.ts: generateTrip() (parallel for 5+ days)
  → lib/google-places.ts: validateRestaurants() + geocodeAllPlaces()
  → lib/route-optimizer.ts: optimizeRoutes()
  → lib/storage.ts: saveTrip() (Redis)
  → lib/unsplash.ts: fetchHeroImage() (background)
  → lib/og.tsx: generateAndUploadOgImage() (background)
```

Key files:
- `lib/claude.ts` — Claude prompt, JSON parsing, retry logic, parallel generation
- `lib/types.ts` — Trip, DayPlan, Place types (Zod schemas)
- `lib/storage.ts` — Redis storage (prod) / file storage (dev)
- `lib/i18n.ts` — 3 locales: en, zh-TW, zh-CN
- `lib/example-trips.ts` — 6 hardcoded example trips
- `app/trip/[id]/page.tsx` — Trip page with SEO metadata + JSON-LD
- `components/TripEditor.tsx` — Client-side trip editing
- `components/TripItinerary.tsx` — Day/place rendering with inline editing

## Conventions

- Trip ID: `nanoid(8)`, Redis key: `trip:{id}`
- Trip language 由 input script 決定 (Latin → en, 繁體+粵語 → zh-HK, 繁體 → zh-TW, 簡體 → zh-CN)
- UI locale 同 trip language 分開 (useUILocale hook vs trip.language)
- 每個 full day 最少 4 個 places，午餐 + 晚餐必須有
- `app/sitemap.xml/route.ts` — 唔好用 Next.js MetadataRoute convention（production 會輸出 plain text），用 route handler 手動 build XML

## SEO

- Sitemap: `app/sitemap.xml/route.ts` (route handler, 唔係 convention)
- Robots: `app/robots.ts`
- Trip pages 有 JSON-LD TouristTrip structured data
- OG images 自動生成 + upload 到 Vercel Blob

## Current Status (April 2026)

已上線功能：
- AI 行程生成（parallel generation for 5+ days）
- Google Places restaurant validation + geocoding
- Route optimization
- 協作編輯（任何人有 link 都可以編輯）
- Share (URL copy, QR code, export text)
- Hero images (Unsplash)
- OG images (auto-generated)
- 10 個 seed trips (SEO landing pages)
- 6 個 example trips
- i18n (en, zh-TW, zh-CN)

下一步：
1. Reddit / 小紅書 marketing
2. Stripe Trip Pass ($2.99)
3. App Store (May 2026)
