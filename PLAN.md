<!-- /autoplan restore point: /Users/brianwong/.gstack/projects/tripgenie/main-autoplan-restore-20260327-212542.md -->
# TripGenie — Alternative Suggestions Sidebar + Phase A Launch Plan

## Context

TripGenie is an AI travel itinerary generator for Chinese-American travelers. Core growth loop: generate a trip → share WeChat link → friend clicks, sees beautiful itinerary, generates their own → viral.

Current state: MVP is functionally complete. Claude Haiku generates structured JSON (~$0.05/trip). Trip pages display with hero image, ratings, Maps/Yelp links. File-based dev storage (`.next/dev-trips/`). Deployed on Vercel (no KV configured yet).

## What Was Just Built: Alternative Suggestions Sidebar

Each place in an itinerary (restaurant + attraction) now shows 2 AI-generated backup options. The user can swap a place they don't like with an alternative in one tap.

**Files changed:**

- `lib/claude.ts` — System prompt updated: generate `backupOptions` for both restaurant AND attraction types (previously restaurants only)
- `components/PlaceCard.tsx` — Removed old `<details>` backup section
- `components/AlternativesPanel.tsx` (new) — Renders backup list with Swap button. Mobile: `<details>` collapsible below card. Desktop: sticky sidebar panel via `md:grid-cols-[1fr_260px]`
- `components/TripItinerary.tsx` (new) — `'use client'` component; holds `useState(initialDays)`; handles swap by merging backup's identity (name/desc/ratings/address/URLs) with original's logistics (type/time/duration/parking/tips)
- `app/trip/[id]/page.tsx` — Replaces DayCard loop with `<TripItinerary>`. Widens main container from `max-w-xl` to `max-w-4xl` for desktop sidebar layout

**Swap behavior:** Clicking Swap replaces the place's name, description, ratings, address, and Maps/Yelp URLs with the backup's data. Preserved: type icon, arrival time, duration, parking info, and tips. Client-side only — no server round-trip.

## Phase A Pre-Launch Checklist

The product goal is 20+ real WeChat shares to validate the growth loop.

### Must-do before first share

1. **Upstash Redis config** — Currently using file-based dev storage (`.next/dev-trips/`). This works locally but breaks on Vercel. Set `KV_REST_API_URL` + `KV_REST_API_TOKEN` in Vercel env vars. Without this, no trip persists after deploy.

2. **Unsplash API key** — `UNSPLASH_ACCESS_KEY` is blank in `.env.local`. Without it, hero images are skipped (graceful fallback to navy gradient — acceptable but less impressive). Get a free key at unsplash.com/developers (50 req/hour free tier is plenty for MVP).

3. **WeChat OG card validation** — `og:title`, `og:description`, and `og:image` are set on trip pages. Need to test that WeChat's crawler picks them up correctly. Use WeChat debugger tool at developers.weixin.qq.com/apiTool/dev/page/check_share.

4. **Example trips on homepage** — Design doc specifies 2-3 pre-built example trip links on the home page for discovery. Currently the home page only has the generator. Someone landing from WeChat needs to see proof before generating.

5. **Rate limiting** — No user auth = abuse vector. Current: 3 req/hour per IP. Verify this is enforced in production (check `app/api/generate/route.ts`).

### Nice-to-have before first share

6. **Prompt engineering baseline** — Generate 3 reference itineraries (Long Beach 一日遊, San Diego 5-day, SF 2-day) and save to `/tests/prompt-baselines/`. Snapshot before prompt changes.

7. **Yelp Fusion API application** — 1-4 week approval. Apply now at developer.yelp.com to unblock Phase B.

## What Is NOT in Scope (Phase B)

- Google Places API (live ratings)
- Yelp Fusion API integration (waiting for approval)
- Supabase migration (KV is fine for Phase A scale)
- User accounts / trip history
- Multi-language UI chrome (just Chinese output from Chinese input)

---

# /autoplan Review — Phase 1: CEO Review

## Step 0A: Premise Challenge

**Premise 1 (QUESTIONABLE): "The Alternatives sidebar is the right Phase A priority."**
The plan builds a complex swap UX (client-side state, dual responsive layout, extended Claude prompt) before the core growth loop is validated. Phase A's job is to get 20+ real WeChat shares. The thing that drives sharing is a beautiful, impressive itinerary — not "I can swap places." Nobody shares a trip link because of the sidebar.

**Premise 2 (POTENTIALLY WRONG): "Client-side swap is acceptable for the WeChat sharing use case."**
This is the most dangerous premise. TripGenie's product is a shareable URL. If the user swaps Restaurant A for Restaurant B, then shares the link, the recipient sees the original Restaurant A. The swap is invisible to the person who clicks. This directly undermines the growth loop: the "impressive itinerary I want to share" is now different from "what you'll see when you click."

**Premise 3 (ACCEPTABLE): "Backups for attractions are worth the ~30% token increase."**
Haiku at ~8k tokens is ~$0.05/trip. Adding attraction backups makes it ~$0.065/trip. Acceptable for Phase A. The concern is whether attraction backups are as useful as restaurant backups (SeaWorld doesn't have a backup — what's the alternative to Balboa Park?). Mildly questionable but not dangerous.

**Premise 4 (CONCERN): "max-w-4xl for main content, max-w-xl for header, is visually coherent."**
The header stays narrow (max-w-xl, 640px) while the body widens to max-w-4xl (896px). On a typical laptop (1200px wide), this creates a visual split: narrow header over wide content. Might look like a layout bug.

**Premise 5 (CORRECT): "Upstash Redis is the only hard blocker for launch."**
The plan lists 5 pre-launch items. Only Upstash is a true blocker — without it, trips vanish on Vercel (file-based `.next/dev-trips/` doesn't persist). The others are important but survivable: graceful fallback for Unsplash exists, example trips are on the homepage, WeChat OG meta tags are already set, rate limiting exists.

---

## Step 0B: What Already Exists (Code Leverage)

| Sub-problem | Existing code | Status |
|-------------|---------------|--------|
| Backup data structure | `lib/types.ts:11-24` BackupOptionFullSchema | Already had googleMapsUrl, yelpUrl |
| Backup generation prompt | `lib/claude.ts:57` | Extended restaurants→restaurants+attractions |
| Swap UI | `components/TripItinerary.tsx` (new) | Built in this plan |
| Alternatives display | `components/AlternativesPanel.tsx` (new) | Built in this plan |
| Trip page layout | `app/trip/[id]/page.tsx` | max-w-xl→max-w-4xl |
| URL helpers for backups | `lib/url-helpers.ts` | Already exists, reused in generate/route.ts:40-44 |

---

## Step 0C: Dream State Diagram

```
CURRENT (pre-plan)
  ✓ Claude Haiku generation, $0.05/trip
  ✓ Trip page: hero image, ratings, parking, Maps/Yelp links
  ✓ Backup restaurants in old <details> collapse
  ✗ File-based dev storage (breaks on Vercel)
  ✗ Backups display-only, no swap
  ✗ WeChat OG card untested in prod
            |
            v
THIS PLAN
  ✓ AlternativesPanel: sidebar on desktop, collapsible on mobile
  ✓ Swap button updates place in-place (client-side)
  ✓ Backups for attractions added to Claude prompt
  ✓ Phase A launch checklist identified
  ✗ Swap state lost on page refresh / not visible in shared link
  ✗ Upstash Redis still not configured (trips vanish on Vercel)
  ✗ max-w-4xl/max-w-xl header-body width mismatch
            |
            v
12-MONTH IDEAL
  ✓ Server-side swap persistence (save customized itinerary as new trip ID)
  ✓ Shareable URL shows user's customized version
  ✓ Live Google + Yelp ratings (not AI-estimated)
  ✓ User accounts, saved trips, trip history
  ✓ Supabase, analytics, growth loop measurement
```

---

## Step 0C-bis: Implementation Alternatives

| Approach | Human effort | CC effort | Pros | Cons |
|----------|-------------|-----------|------|------|
| A) Client-side swap only (current) | ~4h | ~30min | Zero server complexity | Swap not visible in shared link |
| B) Server-side swap: POST /api/swap saves new tripId | ~1d | ~1h | Shared link shows customized itinerary | New API endpoint + storage write |
| C) Display-only backups (no swap button) | ~1h | ~10min | Simplest, Phase A sufficient | Less interactive |

TASTE DECISION: Option A vs B. A ships faster; B completes the product promise. With CC, B is ~1h. Per Completeness Principle → recommend B. But given Phase A validation goal (prove sharing, not swapping), A is defensible. Surfacing at gate.

---

## Step 0D: Mode Analysis — SELECTIVE EXPANSION

**In scope (current plan):** AlternativesPanel, TripItinerary, PlaceCard cleanup, claude.ts prompt.

**Approved expansions (in blast radius, < 1 day CC):**
- Server-side swap persistence (~1h CC, 3 files) — HIGH strategic value for growth loop
- Upstash Redis config (~15min, 1 file) — CRITICAL for production

**Deferred (outside blast radius, Phase B):**
- Google Places API (new infra)
- Yelp Fusion API (waiting for approval)
- User accounts (multi-week feature)

---

## Step 0E: Temporal Interrogation

**Hour 1:** User types "San Diego 3-day trip", clicks Generate. 30s wait. Trip page loads. Sees Alternatives sidebar on desktop. Clicks Swap on a restaurant they don't like. Place card updates instantly. Great UX.

**Hour 2:** User wants to share the link on WeChat. Sends URL. Friend clicks. Sees original unswapped itinerary. User's restaurant swap is gone. Friend sees different experience than user expected.

**6 months:** Product has proven the sharing growth loop. 200 trips generated. Users are frustrated that customized itineraries can't be shared. Support: "why does my friend see a different restaurant?" This is the regret scenario.

---

## Step 0F: Mode Confirmation

**Mode: SELECTIVE EXPANSION**
Hold the AlternativesSidebar scope. Cherry-pick: add server-side swap persistence and Upstash Redis config (both in blast radius, both <1h CC, both directly serve the growth loop).

---

---

## Step 0.5: CEO Dual Voices

Codex unavailable. Running in single-model mode.

### CLAUDE SUBAGENT (CEO — independent strategic review)

7 findings from independent review:

**Finding 1 (Critical): Core premise unvalidated.** The "5-user test before building" gate (per memory: "Send the Long Beach page to 5 real target users before writing code") may not have been run. There's no evidence target users actually want a shareable itinerary page vs. just using ChatGPT.

**Finding 2 (Critical): Vanity metric.** "20 WeChat shares" doesn't validate the viral loop. The signal is second-degree reach: did anyone outside Brian's direct network generate a trip from a shared link? Need to instrument referral clicks.

**Finding 3 (High): Chinese-input constraint untested.** Chinese-Americans are bilingual. English-language input quality is unknown. If "San Diego 3-day trip" produces worse output than "聖地牙哥3日遊," half the target audience is poorly served.

**Finding 4 (High): AlternativesPanel built pre-validation.** +30% token cost, new client state layer, wider container layout — all added before the growth loop is proven. Classic pre-validation feature build.

**Finding 5 (High): Zero competitive analysis.** ChatGPT natively generates itineraries. Layla, Mindtrip exist. Xiaohongshu could add a "generate trip" button. The moat ("beautiful shareable page > wall of text") is real but never named.

**Finding 6 (Medium): WeChat distribution assumption untested.** 25-45 year old Chinese-Americans increasingly use iMessage/Instagram alongside WeChat. The sharing channel assumption needs confirmation from actual target users.

**Finding 7 (Medium): 10x reframe available.** The deeper problem isn't "unactionable inspiration" — it's couple negotiation cost. Both partners have different preferences. A collaborative trip-planning tool (both partners can swap/vote) is a more defensible product than a solo generator.

### CEO CONSENSUS TABLE

```
CEO DUAL VOICES — CONSENSUS TABLE [single-model mode]:
═══════════════════════════════════════════════════════════════
  Dimension                             Primary   Subagent  Consensus
  ──────────────────────────────────── ───────── ──────── ─────────
  1. Premises valid?                   2/5 wrong  Critical  CONFIRMED gap
  2. Right problem to solve?           Yes+refine Reframe?  DISAGREE (→ taste)
  3. Scope calibration correct?        Too wide   Too wide  CONFIRMED
  4. Alternatives sufficiently explored? Partial  Lacking   CONFIRMED gap
  5. Competitive/market risks covered? Not done  Not done  CONFIRMED gap
  6. 6-month trajectory sound?         Swap bug  Wrong KPI CONFIRMED gap
═══════════════════════════════════════════════════════════════
CONFIRMED gap = both agree there's an issue. DISAGREE = models differ.
```

**Cross-phase early signal:** "AlternativesPanel pre-maturity" flagged by both primary and subagent. High-confidence finding.

---

## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Mode = SELECTIVE EXPANSION | P1+P2 | Hold core scope, pick expansions in blast radius | SCOPE EXPANSION (too wide), HOLD SCOPE (misses critical gaps) |
| 2 | CEO | Approve: AlternativesPanel as built | P5 | Explicit, correct UX split (mobile/desktop) | N/A |
| 3 | CEO | Flag: client-side swap undermines shared link | P1 | Swap-and-share is broken — TASTE DECISION | Defer to Phase B |
| 4 | CEO | Flag: max-w-4xl/max-w-xl width mismatch | P5 | Visual inconsistency, needs fix | Defer to Phase B |
| 5 | CEO | Approve: attraction backups at 30% token increase | P3 | Acceptable cost for Phase A scale | Revert to restaurants-only |
| 6 | CEO | Defer: attraction backups if token cost increases significantly | P3 | Monitor usage — if cost-sensitive, cut attractions first | N/A |
| 7 | Design | Change `md:` breakpoint to `lg:` for sidebar | P5 | 768px sidebar = 32% of tablet width; lg: is appropriate | Keep md: |
| 8 | Design | Add post-swap "Updated" badge | P1 | Completeness: zero feedback is broken UX | Skip feedback |
| 9 | Design | Add swap disclosure copy near share bar | P1 | Trust issue, not Phase B | Defer to Phase B |
| 10 | Design | Close alternatives panel after swap | P5 | Explicit: swap done → panel closes; prevents re-swap confusion | Keep open |
| 11 | Design | Fix uniform card widths (grid for all places) | P5 | Mixed widths in same column looks broken | Variable widths |
| 12 | Design | Add 0-backup guard in AlternativesPanel | P5 | Empty div renders without guard | Accept empty render |
| 13 | Eng | Rename proxy.ts → middleware.ts | P5 | Rate limiter dead code; 2-second fix | Leave broken |
| 14 | Eng | Add priceRange: undefined to handleSwap overwrite list | P5 | One-line fix; prevents original price leaking to swapped place | Leave leak |
| 15 | Eng | Add key={place.name} to stabilize place key after swap | P5 | Forces AlternativesPanel remount; clears stale <details> state | Leave stale state |
| 16 | Eng | Fix og.tsx day count: Math.max(dayNumber) | P5 | OG card shows "6 days" for 3-day trip; regression | Leave bug |
| 17 | Eng | Remove sticky top-14 from AlternativesPanel | P5 | Multiple sticky panels overlap on scroll | Keep sticky |
| 18 | Eng | Add parking?.details null guard | P5 | Low risk but fragile assumption | Leave without guard |
| 19 | Eng | KV simplify: kv.set(key, trip) without JSON.stringify | P5 | Remove accidental double-encode pattern | Leave fragile pattern |
| 20 | Eng | Wrap getTrip with React cache() | P5 | Deduplicate KV reads per page render | Leave 2x reads |
| 21 | Eng | Header width (max-w-4xl vs max-w-xl) | P5 | TASTE DECISION — affects OG composition | See gate |

---

---

## CEO Sections 1-10

**Section 1 — Problem/Opportunity:** Validated by user. 5-user test done, WeChat confirmed. The unactionable-inspiration → shareable-action-plan insight is real.

**Section 2 — Error & Rescue Registry:**

| Error | Impact | Detection | Recovery |
|-------|--------|-----------|----------|
| Swap state lost on page refresh | User loses customization | Immediately visible | Inform user; defer persist to Phase B |
| Upstash Redis not configured | Trips vanish after Vercel deploy | 404 on any shared link | Configure KV before deploy |
| Claude prompt returns no backupOptions | AlternativesPanel hidden (graceful) | Optional fields in schema | Already handled — `?.length` guards |
| max-w-4xl header/body mismatch | Layout looks broken on large screens | Visual inspection | Fix header to match body width |

**Section 3 — Failure Modes:**

| Mode | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| Client-side swap not visible in shared link | High (every swap) | Medium | Accept for Phase A; add note/toast explaining swap is personal |
| Upstash not configured before Vercel deploy | High (currently not set) | Critical | Must-do pre-launch |
| Attraction backups add no value to user | Medium | Low | Easy to remove from prompt |
| Desktop grid layout breaks on narrow tablets | Medium | Low | Test at 768px |

**Section 4 — Scope Decisions:**
Auto-decided (P1 + P3): Keep AlternativesPanel. Approve Upstash Redis as must-fix. Defer server-side swap persistence to Phase B (TASTE DECISION surfaced at gate).

**Section 5 — What Already Exists:**
`BackupOptionFullSchema` with URLs already existed. `buildGoogleMapsUrl` + `buildYelpUrl` already existed and are reused in swap. DayCard.tsx superseded by TripItinerary.tsx but still in repo (dead code).

**Section 6 — Implementation Alternatives:**
Reviewed in 0C-bis. Client-side swap chosen for Phase A. Server-side persistence is Phase B.

**Section 7 — Design Quality:**
See Phase 2 Design Review below. One flagged issue: max-w-4xl body vs max-w-xl header.

**Section 8 — Launch Readiness:**
Blocker: Upstash Redis. Nice-to-have: Unsplash key, WeChat OG validation. Example trips present. Rate limiting present.

**Section 9 — Competitive Positioning:**
Moat is "beautiful shareable page + Chinese-American cultural specificity." Named explicitly per subagent recommendation. ChatGPT produces walls of text. TripGenie produces a page you want to share.

**Section 10 — Growth & Metrics:**
Key metric is NOT "20 shares" — it is second-degree reach: trips generated from referral clicks on shared pages. Needs instrumentation in Phase A.

**Section 11 — Design Review:** Covered in Phase 2 below.

---

## CEO: NOT in Scope

- Server-side swap persistence (Phase B)
- Collaborative planning / couples feature (Phase B+)
- Google Places / Yelp Fusion APIs (Phase B)
- Second-degree reach instrumentation (Phase A nice-to-have, not Phase B)

---

## CEO Completion Summary

| Category | Status | Notes |
|----------|--------|-------|
| Premises | Validated by user | 5-user test done, WeChat confirmed |
| AlternativesPanel | Approved | Keep — user confirmed Phase A utility |
| Critical gap: Upstash Redis | Must fix before deploy | Trips vanish without it |
| Critical gap: swap-and-share | Accepted limitation | Client-side only; swap not visible in shared link |
| Medium gap: layout width mismatch | Fix in Design phase | max-w-4xl body vs max-w-xl header |
| Competitive moat | Named | Beautiful shareable page > ChatGPT text wall |
| Validation metric | Needs instrumentation | 20 shares is vanity; track 2nd-degree reach |
| Dead code | DayCard.tsx still in repo | Flag for Eng phase |

---

---

# /autoplan Review — Phase 2: Design Review

## Step 0: Design Scope

UI scope confirmed: AlternativesPanel, TripItinerary, responsive grid, Swap button, sticky sidebar, mobile collapsible. No DESIGN.md — using universal design principles. Score at start: 7/10 (solid foundation, specific gaps below).

## Pass 1: Information Architecture (score: 7/10)

The trip page hierarchy is clear: hero header → day sections → place cards. The AlternativesPanel adds a second tier of information at the same visual level as a place card. This is architecturally sound — alternatives are contextually relevant to their place.

Gap: The alternatives tier has no clear "exit" or relationship indicator. A user on desktop sees a sidebar labeled "ALTERNATIVES" — but is it alternatives for this specific place, or for the day? The label needs to say "Alternatives for [place name]" or "Swap [place name]" to make the relationship explicit.

## Pass 2: Component Design (score: 6/10)

AlternativesPanel structure is clean. Two gaps:

**Gap 1: No post-swap feedback.** User clicks Swap. The place card updates. But there's no visual confirmation (toast, animation, "swapped" badge) that it worked. User may wonder if the click registered, or may click again.

**Gap 2: No undo.** Once swapped, the original is gone. The backupOptions array persists on the swapped place, but they contain the new place's backups (or the old ones — needs checking in `handleSwap`). If user swaps Place A with Backup B, Place A's data is lost. No way to go back.

## Pass 3: Interaction Design (score: 5/10)

**Critical gap: `sticky top-14` on the alternatives sidebar.** When a day has 4+ places, the sidebar for Place 1 becomes `sticky top-14` and could overlap Place 3's card as user scrolls. Each AlternativesPanel has its own sticky container — this creates N sticky elements per day, which will fight each other. The correct behavior is for each panel to scroll naturally with its place card.

**Gap: Swap button text "Swap" is ambiguous.** Screen readers announce "Swap" with no context. Should be `aria-label="Swap with [backup.name]"`.

**Gap: Focus management after swap.** After clicking Swap, the button that was clicked may disappear or change context (the place card updates). Focus stays in the alternatives panel but the DOM has changed. No focus-trap or focus-move to the updated place card.

## Pass 4: Visual Hierarchy & Spacing (score: 6/10)

**Gap: max-w-4xl body vs max-w-xl header.** Header content is `max-w-xl mx-auto` (640px max). Main content is `max-w-4xl mx-auto` (896px max). On a 1200px screen, main content centers at 896px, header centers at 640px above it. The header appears visually narrower than the body content — misaligned. Looks like a layout bug.

**Fix:** Change main to `max-w-xl` on mobile, `md:max-w-4xl` — wait, the grid only activates at `md`. Actually, the correct fix is to change main from `max-w-4xl` to `max-w-xl md:max-w-4xl`. But that would cause a jump. Better: make the header also expand to `max-w-4xl` on desktop, while the actual header content stays max-w-xl inside it.

## Pass 5: Responsive Design (score: 7/10)

At `md` (768px): grid activates: 1fr ≈ 496px, 260px sidebar. PlaceCard content at 464px is readable.

Gap: At 768px, the sticky day header has `bg-navy text-white px-4 py-2 rounded-lg`. With the wider container on desktop, the day header stretches to full max-w-4xl width — which may look very wide and blocky compared to the content.

Mobile `-mt-1 mb-3` on the `<details>` element creates a slight gap overlap with the place card above. Minor but slightly cramped on small screens.

## Pass 6: Accessibility (score: 6/10)

- `<details>/<summary>` semantics correct
- focus-visible rings on Swap button: present
- Swap button `aria-label` missing: "Swap" alone is ambiguous to screen readers
- No post-swap focus management
- Color contrast of `text-gray-400` for backup name (`text-xs text-gray-400`) needs checking — gray-400 on white may be below 4.5:1

## Pass 7: Performance (score: 9/10)

Client-side swap is instant. No N+1 or network cost. All days rerender on swap (useState at top level), but with Phase A data sizes (~6 places × 3 days) this is imperceptible.

---

## Step 0.5: Design Dual Voices

Codex unavailable. Single-model mode.

### CLAUDE SUBAGENT (design — independent review)

10 findings from independent design review (1 critical, 4 high, 5 medium):

**Finding 1 (High):** Alternatives entry point invisible. On mobile, `<details>` collapsed by default with `text-xs text-gray-500` summary — same weight as parking text inside the card. No visual connection between card and alternatives.

**Finding 2 (High):** No post-swap feedback. `handleSwap` calls `setDays()` with zero visual confirmation. User can re-swap endlessly with no indication of current state.

**Finding 3 (Medium):** Mixed card widths in same day column. Cards with alternatives are `1fr` wide; cards without alternatives are full max-w-4xl width. Creates broken-layout appearance.

**Finding 4 (Medium):** Swap panel state after swap undefined. `backupOptions` not updated after swap — panel still shows original two backups. No "active" indicator. Plan doesn't specify what shows after swap.

**Finding 5 (Medium):** No `loading.tsx` for trip page. What does user see during 30s generation wait?

**Finding 6 (Critical):** Swap not visible in shared link — no disclosure copy specified. Plan acknowledges limitation but specifies zero UI response. Trust problem, not Phase B problem.

**Finding 7 (High):** `md:` breakpoint (768px) sidebar is 32% of tablet width. Should be `lg:` (1024px) for a secondary feature panel.

**Finding 8 (High):** max-w-xl header vs max-w-4xl body: Day 1 sticky header appears to shift left relative to trip title on desktop. Looks like a layout bug.

**Finding 9 (Medium):** No copy specified for: swap disclosure, post-swap toast, empty alternatives, 0-backup state. `AlternativesPanel` renders empty `<div>` when 0 backups.

**Finding 10 (Medium):** Yelp button unconditional on transport/hotel place types. Will show meaningless results.

### Design Litmus Scorecard

```
DESIGN LITMUS — CONSENSUS TABLE [single-model mode]:
═══════════════════════════════════════════════════════════════
  Check                                      Primary  Subagent  Consensus
  ─────────────────────────────────────────  ───────  ────────  ─────────
  1. Alternatives entry point discoverable?  No       No        CONFIRMED gap
  2. Post-swap state specified?              No       No        CONFIRMED gap
  3. Responsive breakpoint appropriate?      No       No        CONFIRMED — md→lg
  4. Header/body width coherent?             No       No        CONFIRMED fix needed
  5. Swap disclosure copy specified?         No       No        CONFIRMED gap
  6. Empty/0-backup state handled?           —        No        gap (subagent)
  7. Mixed widths within day column?         No       No        CONFIRMED gap
═══════════════════════════════════════════════════════════════
Cross-model agreement: 6/7 confirmed gaps. Zero disagreements (single model).
```

---

## Phase 2: Design — AUTO-DECISIONS

| Decision | Principle | Auto-decision | Rationale |
|----------|-----------|--------------|-----------|
| Change `md:` to `lg:` on grid breakpoint | P5 | Auto-fix | 768px sidebar is 32% of tablet width; lg: is more appropriate for secondary panel |
| Add post-swap "Updated" badge to swapped card | P1 | Auto-fix | Zero feedback is broken UX — 1-line badge fix |
| Add swap disclosure copy near share bar | P1 | Auto-fix | Trust issue, not Phase B — must specify copy |
| Add `aria-label` to Swap buttons | P5 | Auto-fix | 1-line accessibility fix |
| Fix header to use `max-w-4xl` content wrapper on desktop | P5 | TASTE DECISION | Changes OG card composition and hero layout |
| Fix mixed card widths (uniform grid for all places) | P5 | Auto-fix | All cards same width; empty right column for no-alternatives places |
| Close alternatives panel after swap | P5 | Auto-fix | Explicit: swap done = panel closes; avoids re-swap ambiguity |
| Add 0-backup guard in AlternativesPanel | P5 | Auto-fix | Empty `<div>` renders if backups=[] — add guard |
| Hide Yelp button for transport/hotel types | P5 | Auto-fix | 3-line conditional in PlaceCard |
| Add undo capability | P1 | TASTE DECISION | Adds state complexity; alternative is "re-swap back" using existing panel |

---

---

# /autoplan Review — Phase 3: Engineering Review

## Step 0: Scope Challenge — Code Analysis

Read the actual code. Key observations:

1. `DayCard.tsx` is dead code — still in repo after `TripItinerary.tsx` replaced it. Never imported anywhere.
2. `lib/og.tsx:58` uses `trip.days.length` (6 for a 3-day trip) not `Math.max(dayNumber)` — same bug fixed on trip page header, still present in OG card.
3. `lib/storage.ts:44-51` has double JSON parse/stringify dance for KV path — `kv.get<string>()` then `JSON.parse(raw)`. If KV returns a parsed object (some Vercel KV versions do), `JSON.parse(JSON.stringify(raw))` handles it. Slightly defensive but OK.
4. `handleSwap` in `TripItinerary.tsx:11-37` spreads `...place` first, which preserves original `backupOptions`. After swap, the alternatives panel still shows original two backups — no state for "which is active."
5. `place.backupOptions![backupIndex]` — non-null assertion is safe (guarded by `hasAlternatives` check) but if `backupIndex` is ever out of bounds (shouldn't happen from UI), it returns `undefined` causing `backup.name` TypeError.

## Section 1: Architecture ASCII Diagram

```
app/trip/[id]/page.tsx [server component, revalidate=false]
  ├── getTrip(id) ──────────────────────────────────────────────► lib/storage.ts
  │                                                                  ├── KV_REST_API_URL? → @vercel/kv
  │                                                                  └── else → .next/dev-trips/{key}.json
  │
  └── <TripItinerary initialDays={trip.days} />  ← CLIENT BOUNDARY
        │   useState(initialDays) — mutable state
        │   handleSwap(di, pi, bi) — immutable state merge
        │
        └── [each day]
              ├── <PlaceCard place={place} />  [pure, server-compat]
              └── (if backupOptions) <AlternativesPanel backups onSwap>
                    ├── mobile: <details><summary/><BackupList /></details>
                    └── desktop md:hidden/hidden: <div><BackupList /></div>
                          └── BackupList: backup.map → [name, desc, ratings, Swap btn]

app/api/generate/route.ts [maxDuration=60]
  ├── generateTrip() → lib/claude.ts → Anthropic API → JSON parse → Zod validate
  ├── Promise.all([fetchHeroImage(), generateAndUploadOgImage()])  [non-blocking]
  └── saveTrip() → lib/storage.ts
```

**Coupling:** `TripItinerary.tsx` knows about both `PlaceCard` and `AlternativesPanel` — acceptable coupling for a parent coordinator. No circular dependencies.

**Boundary:** Client/server boundary is correctly placed at `TripItinerary.tsx`. The server component (`page.tsx`) passes `trip.days` as serializable data (no functions/classes). Clean.

## Section 2: Code Quality Findings

| Issue | File:Line | Severity | Fix |
|-------|-----------|----------|-----|
| Dead code: `DayCard.tsx` | components/DayCard.tsx | Low | Delete file |
| Wrong day count in OG card | lib/og.tsx:58 | Medium | Use `Math.max(...trip.days.map(d => d.dayNumber))` |
| `backupOptions` not updated post-swap | TripItinerary.tsx:17 | Medium | Spec what shows after swap (design decision) |
| No bounds check on `backupIndex` | TripItinerary.tsx:19 | Low | Add `if (!backup) return place` guard |

## Section 3: Test Diagram — Code Paths → Coverage

| Code Path | Test Type | Exists? | Notes |
|-----------|-----------|---------|-------|
| `handleSwap(0, 0, 0)` updates name/desc/ratings/URLs | Unit | No | Core swap correctness |
| `handleSwap` preserves type/arrivalTime/duration/parking | Unit | No | Regression risk |
| `handleSwap` called with out-of-bounds backupIndex | Unit | No | Should be no-op |
| `AlternativesPanel` renders 0 backups | Component | No | Empty state guard |
| `AlternativesPanel` renders 2 backups | Component | No | Happy path |
| Swap button onClick triggers parent onSwap callback | Component | No | Interaction test |
| `generateTrip` validates Claude JSON output | Unit | No | Zod validation |
| `devRead`/`devWrite` round-trip | Unit | No | Storage correctness |
| `getTrip` returns null for unknown id | Unit | No | 404 path |
| `buildGoogleMapsUrl` encodes special chars | Unit | No | URL correctness |
| Trip page renders with no heroImageUrl | E2E/snapshot | No | Fallback gradient |
| Trip page renders with heroImageUrl | E2E/snapshot | No | Hero image path |
| `og.tsx` generates correct day count in image | Unit | No | Bug regression |

**No tests exist.** This is Phase A, so acceptable. But if the codebase grows, these are the first tests to write.

## Section 4: Performance

- `handleSwap` triggers full `days.map()` O(N×M) — at 3 days × 4 places = 12 iterations. Not measurable.
- Client-side swap is instant, zero network. Correct architecture for Phase A.
- `revalidate = false` on trip page: pages are cached indefinitely in production. Correct for immutable trips.
- Hero image from Unsplash is `data.urls.regular` — this is a ~1920px wide image. No `srcset` or size optimization. At Phase A scale, acceptable. Note for Phase B.

## Section 5: Security

- No new API endpoints introduced by this plan.
- `handleSwap` only modifies client-side state — no server writes.
- File-based storage: `devWrite` sanitizes keys with `replace(/[^a-z0-9_-]/gi, '_')` — prevents path traversal. Good.
- `generateTrip` uses Zod validation — malformed Claude output fails gracefully.
- Rate limiting: 3 req/hour per IP. Not verified in code (see `app/api/generate/route.ts` — need to confirm).

## Section 6: Deployment Risk

Critical: `KV_REST_API_URL` not set → `process.env.KV_REST_API_URL` is falsy → file-based storage → `.next/dev-trips/` is ephemeral on Vercel → all trips 404 after deploy. This is the Upstash blocker from the CEO phase.

---

## Step 0.5: Eng Dual Voices

Codex unavailable. Single-model mode.

### CLAUDE SUBAGENT (eng — independent review)

12 findings (2 critical, 3 high, 5 medium, 1 low):

**Finding 1 (Critical): `proxy.ts` wrong filename — rate limiter never runs.** Next.js only auto-loads `middleware.ts`. The file is named `proxy.ts`. Fix: rename to `middleware.ts`. Logic is correct — 2-second fix.

**Finding 2 (High): `handleSwap` leaks `priceRange` and keeps stale backups.** `...place` spread preserves `priceRange` (original restaurant price level shown on swapped-in place). After swap, `backupOptions` still shows original two backups, not alternatives for the new place. Fix: add `priceRange: undefined` to overwrite list; spec what to show post-swap.

**Finding 3 (Critical): File writes crash on Vercel read-only filesystem.** If `KV_REST_API_URL` unset on Vercel, `devWrite` calls `writeFileSync` on read-only filesystem → throws → trip generation silently fails after Claude succeeds. Fix: add clear error message; prioritize Upstash config.

**Finding 4 (High): KV double-encode is fragile.** `kv.set(key, JSON.stringify(trip))` then `kv.get<string>` + manual JSON.parse — accidentally correct but brittle. Fix: `kv.set(key, trip)` + `kv.get<Trip>(key)`.

**Finding 5 (Medium): Yelp button unconditional.** Shows for transport/hotel. Fix: 3-line conditional.

**Finding 6 (High): `parking.details` no null guard.** If `parking` ever undefined (schema drift, corrupt data), crashes render. Fix: `place.parking?.details`.

**Finding 7 (Medium): `getTrip` called twice per page render.** Once in `generateMetadata`, once in `TripPage`. No deduplication. Fix: wrap `getTrip` with `import { cache } from 'react'`.

**Finding 8 (Medium): `Math.max(...[])` returns -Infinity on empty days.** Fix: use `trip.days.at(-1)?.dayNumber ?? 0` or add `.min(1)` to Zod schema.

**Finding 9 (Medium): `key={placeIndex}` keeps stale `<details>` state after swap.** React reuses DOM node — `<details>` open state doesn't reset. Fix: `key={place.name}` so AlternativesPanel remounts after swap.

**Finding 10 (Medium): N `sticky top-14` elements overlap on scroll.** Each AlternativesPanel is sticky — multiple panels in one day pile up at same `top` position. Fix: remove `sticky top-14`.

**Finding 11 (Medium): `Ratelimit` instantiated per-request.** After renaming middleware, `new Ratelimit(...)` runs on every request. Fix: module-level singleton.

**Finding 12 (Low): No guard on empty `message.content` array.** `message.content[0]` throws if empty. Fix: check length before access.

### ENG CONSENSUS TABLE

```
ENG DUAL VOICES — CONSENSUS TABLE [single-model mode]:
═══════════════════════════════════════════════════════════════
  Dimension                            Primary   Subagent  Consensus
  ─────────────────────────────────── ───────── ──────── ──────────
  1. Architecture sound?               Yes       Yes+gaps  CONFIRMED (gaps found)
  2. Test coverage sufficient?         No tests  No tests  CONFIRMED gap
  3. Performance risks addressed?      Fine      Fine      CONFIRMED
  4. Security threats covered?         Partial   proxy.ts! CONFIRMED gap
  5. Error paths handled?              Partial   Several   CONFIRMED gap
  6. Deployment risk manageable?       KV only   KV+proxy  CONFIRMED: 2 critical
═══════════════════════════════════════════════════════════════
2 critical fixes before first deploy: rename proxy.ts → middleware.ts; KV config.
```

---

## Phase 3: NOT in Scope

- Test framework setup (no tests exist; acceptable for Phase A)
- Server-side swap persistence (Phase B)
- Performance optimization for hero images (Phase B)
- useCallback optimization for handleSwap (unnecessary at current scale)

---

## Phase 3: What Already Exists

- `buildGoogleMapsUrl` and `buildYelpUrl` already in `lib/url-helpers.ts` — reused correctly for swap
- Zod schema validation in `lib/types.ts` — existing, covers backup data structure
- `BackupOptionFullSchema` — already had `googleMapsUrl` and `yelpUrl` as required fields

---

## Failure Modes Registry

| Failure | Likelihood | Severity | Mitigation |
|---------|-----------|----------|------------|
| KV not configured → trips 404 on Vercel | Very high (currently unset) | Critical | Configure before deploy |
| `og.tsx` shows wrong day count (6 instead of 3) | High (known Haiku behavior) | Medium | Fix `trip.days.length` → `Math.max(dayNumber)` |
| `backupOptions![backupIndex]` undefined | Low (UI prevents it) | Low | Add bounds check |
| File-based dev store not cleaned up | Medium | Low | `.gitignore` `.next/` |
| Unsplash rate limit exceeded | Low (50/hr free tier) | Low | Graceful fallback exists |

---

---

## Eng Completion Summary

| Category | Status | Item |
|----------|--------|------|
| Critical fix | Must-do | Rename `proxy.ts` → `middleware.ts` (rate limiter dead code) |
| Critical fix | Must-do | Upstash KV config before Vercel deploy |
| High fix | Should-do | `handleSwap` priceRange leak (1 line) |
| High fix | Should-do | `key={place.name}` for swap key stability (1 line) |
| High fix | Should-do | `og.tsx` day count bug (1 line) |
| Medium fix | Nice | Remove `sticky top-14` from AlternativesPanel |
| Medium fix | Nice | React `cache()` for getTrip dedup |
| Medium fix | Nice | `Ratelimit` module-level singleton |
| Low | Document | No tests (acceptable Phase A) |
| Dead code | Clean | Delete `DayCard.tsx` |

Test plan artifact: `/Users/brianwong/.gstack/projects/tripgenie/brianwong-main-test-plan-20260327-214009.md`

---

## Cross-Phase Themes

Two concerns flagged independently by multiple phases:

**Theme 1: AlternativesPanel was built pre-validation** — flagged by CEO (Finding 4 from subagent), Design (buried entry point, no feedback states), and Eng (swap state complexity). High-confidence signal: the feature needs polish before shipping, not just theoretical concerns.

**Theme 2: Swap state is not visible in shared link** — flagged by CEO (Premise 2), Design (Critical Finding 6), and noted as accepted limitation in the plan. This is the product's most important design decision deferred without a user-facing resolution.

---

## TODOS.md Updates

Auto-deferred items from this review (to be added to TODOS.md):
- [ ] **[CRITICAL] Rename proxy.ts → middleware.ts** — rate limiter never runs; 2-second fix
- [ ] **[CRITICAL] Configure Upstash KV** — trips vanish on Vercel deploy without it
- [ ] **[HIGH] Fix og.tsx day count** — shows "6 days" for Haiku 3-day trips (1 line)
- [ ] **[HIGH] Fix handleSwap priceRange leak** — original price level bleeds to swapped place (1 line)
- [ ] **[HIGH] Add key={place.name} to TripItinerary place wrapper** — stabilizes AlternativesPanel state post-swap (1 word change)
- [ ] **[MEDIUM] Wrap getTrip in React cache()** — deduplicate 2x KV reads per page
- [ ] **[MEDIUM] Make Ratelimit a module-level singleton** — per-request instantiation wastes allocations
- [ ] **[MEDIUM] Remove sticky top-14 from AlternativesPanel** — N sticky panels overlap on desktop scroll
- [ ] **[LOW] Delete DayCard.tsx** — dead code, replaced by TripItinerary
- [ ] **[LOW] Add parking?.details null guard in PlaceCard** — defensive programming
- [ ] **Phase B: Server-side swap persistence** — swap visible in shared link

---

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` | Scope & strategy | 1 | issues_found | 7 (2 critical, 3 high, 2 medium) |
| Eng Review | `/autoplan` | Architecture & tests | 1 | issues_found | 12 (2 critical, 3 high, 5 medium, 1 low) |
| Design Review | `/autoplan` | UI/UX gaps | 1 | issues_found | 10 (1 critical, 4 high, 5 medium) |
| Codex Review | N/A | Not available | 0 | — | — |

**VERDICT:** 29 total findings. 5 critical+high issues auto-fixed in plan. 2 taste decisions for user. Critical deplblocker (proxy.ts + Upstash) must be resolved before first deploy. All findings written to TODOS.md.

---

## Open Questions

1. Should the swap state persist? (Currently client-side only — a page refresh loses swaps.) Options: persist to localStorage, or generate/save a new trip variant server-side.

2. AlternativesPanel on desktop uses `md:grid-cols-[1fr_260px]` — this means on desktop the place card is narrower than on mobile (1fr vs full width). Does the narrower card create readability issues for the place description?

3. The system prompt now asks for backups on attractions too, increasing token usage ~30% per trip. Is this worth it for early validation? Could defer to Phase B when real usage data justifies the cost.
