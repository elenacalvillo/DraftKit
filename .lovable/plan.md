## What you're asking

You want every tile, funnel, and chart to **show its formula**, so nobody (you, me, or a future PM) has to guess what a number means. Today the math lives in `AdminAnalytics.tsx` and `Dashboard.tsx` but is invisible to the reader.

Below is **exactly how each metric is computed today** (verified from the code), followed by what I'll add to the UI.

---

## How every metric is calculated today

### Dashboard (`/dashboard`) — your stats row

| Tile | Formula | Source |
|---|---|---|
| **Ship Rate** | `published requests ÷ eligible requests × 100` (eligible = not pending/declined/expired) | `collab_requests.status` |
| **Published Collabs** | `count of UNIQUE requester_substack_url` where `status = 'published'` | `collab_requests` |
| **Time Saved** | `published_count × (8.5 − 1.0) = published × 7.5 hrs` | Two constants in `Dashboard.tsx`: `MANUAL_TAX_HOURS=8.5`, `DRAFTKIT_EFFICIENCY_HOURS=1.0` |

> The "7.5 hrs per published collab" number is currently a **hard-coded baseline**, not a per-user measurement. The legend will say so explicitly so we don't oversell it.

### Admin Analytics (`/admin/analytics`) — every tile and funnel

All counts are scoped to the **selected range** (URL `?range=`), pulled in 1000-row pages up to 5000 rows from `analytics_events`. Δ comparisons use the prior window of the same length.

**KPI tiles**

- **Draft Acceptance Rate** = `unique request_ids with draft_accepted ÷ count(draft_generated) × 100`. Red ring when <30% and there are drafts.
- **AI Attachment Rate** = `bookings where event_data.used_ai_suggestion=true ÷ bookings × 100`.
- **Regeneration Rate** = `draft_regeneration_requested ÷ draft_generated × 100`. Amber ring above 50%.
- **Guest Conversion** = `user_signup ÷ booking_submitted × 100`. Yellow ring when <5% and ≥10 bookings.
- **Avg Session Duration** = mean of `event_data.session_duration_ms` on `booking_submitted` events.
- **Booking Conversion** = `booking_submitted ÷ booking_link_clicked × 100`.
- **SMART Suggestions Used** = raw count of `ai_match_suggestion_selected`.
- **User Signups** = raw count of `user_signup` + Δ vs prev window.
- **Workspace save failures** = raw count of `workspace_save_failed` + top reason from `event_data.reason` + recovered count.

**Push to Substack block** (`src/lib/analytics-push-funnel.ts`)

- All four steps are **deduped by `event_data.request_id`** — 10 clicks on the same draft = 1 intent.
- **Substack Push Rate** = `success ÷ (success + blocked) × 100`.
- **Pro pushes** = unique `push_to_substack_success` (with Δ).
- **Blocked → Upgrade** = `(unique user_ids that fired blocked AND later checkout_completed) ÷ unique blocked users × 100`. Anonymous blocked users don't count.
- Funnel rows: Workspace opened → Copy clicks (filtered to `surface = workspace_copy`) → Push success → Push blocked.

**Core funnel** (Link clicks → SMART match → Booking → Draft generated → Draft copied)

- Each step % is computed **vs. the first step** (Link Clicks = 100%); the small `(N%)` next to each row is the **step-over-step** conversion. That's two different denominators living next to each other — the legend will make this explicit.

**Monetization funnel**

- Rows: Pro feature blocked (Push) → Upgrade prompt shown → clicked → Checkout started → Checkout completed. Each row's `%` next to the count is vs. the previous row.

**Other funnels** (Referral / Invite / Discovery): same pattern — raw event counts in order, with step-over-step %.

**Signup Attribution** = `count by event_data.source ÷ total signup_attribution × 100`.

**Feature Usage Matrix** = per `event_type`: total count, unique `user_id` count, Δ vs prev window.

---

## What I'll add (UI changes only — no formula changes)

The goal is "every number explains itself, on hover, in one line." Two complementary touches:

1. **One-line legend under each value** (already there for DAR; I'll extend the pattern). Example: under "Substack Push Rate" → *"success ÷ (success + blocked), deduped by request_id."*

2. **Info icon (`<Info className="w-3 h-3" />`) next to every KPI title and funnel header**, opening a Radix tooltip with:
   - The plain-English definition
   - The exact formula
   - The data source (event types / table)
   - For Time Saved: the constants `8.5 − 1.0 = 7.5 hrs` and a note that it's a baseline, not measured per-user

3. **A `MetricLegend` component** so the copy lives in one place (`src/lib/metric-legends.ts`) — easy to edit, easy to test, no drift between tile and tooltip.

```text
┌─ Card ─────────────────────────────────┐
│ Draft Acceptance Rate    [ⓘ tooltip]   │
│ 42.0%                                  │
│ 21 of 50 drafts accepted               │
│ unique drafts copied/downloaded ÷      │
│   drafts generated                     │
└────────────────────────────────────────┘
```

### Files I'll touch

- **New** `src/lib/metric-legends.ts` — one source of truth: `{ id, title, definition, formula, source }` for every metric on both pages.
- **New** `src/components/admin/MetricInfo.tsx` — tiny tooltip-wrapped `Info` icon.
- **Edit** `src/pages/AdminAnalytics.tsx` — drop `<MetricInfo id="dar" />` next to each title; add a one-liner legend under each value where missing (AI Attachment, Regeneration, Guest, Avg Session, Booking Conversion, Workspace failures, all funnel headers).
- **Edit** `src/pages/Dashboard.tsx` — same treatment for Ship Rate / Published Collabs / Time Saved. Time Saved tooltip explicitly says: *"Baseline estimate: 8.5h of manual coordination per collab − 1.0h with DraftKit = 7.5h saved per published collab. Not measured per-user."*
- **New** `src/lib/__tests__/metric-legends.test.ts` — snapshot test so every metric `id` referenced from the pages exists in the legend map (prevents silent breakage if I rename one).

### Out of scope (will not touch)

- Any **formula change** — including the 8.5/1.0 Time Saved constants. If you want those tweaked, that's a separate, opinionated decision (I'd want your input on the manual baseline).
- New events or DB work.
- Changing how the core funnel mixes "% vs first step" with step-over-step — I'll just *explain* both in tooltips. Happy to unify if you say so.

---

## Two questions before I build

1. **Time Saved baseline** — keep `8.5 − 1.0 = 7.5h` as-is and just disclose it, or do you want to revisit the numbers? (My vote: disclose now, revisit when we have real data from `collab_metrics`.)
2. **Tooltip vs. always-visible legend** — info icon with hover tooltip (clean, dense) or always-visible one-liner under every tile (more obvious, slightly busier)? Default plan does **both**: legend under the value + tooltip with the full formula. Say the word if you want only one.
