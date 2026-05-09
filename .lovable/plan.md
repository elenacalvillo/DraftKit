## Why your numbers look like they dropped

Nothing is being purged. Every analytics event is still in the database forever. The Admin Analytics page just hard-codes a **rolling last-30-days window** when it queries — so as soon as yesterday's spike rolls outside whichever sub-window a tile uses (some tiles are 7d, some 30d), it appears to "disappear." There is currently no way to look back at a specific past week or month, which is exactly what you're asking for.

## What I'll build

A single time-range control at the top of `/admin/analytics` that drives every tile, chart, funnel, and table on the page. No more snapshot-in-time — you'll be able to scrub backwards.

### Range selector (top of page)

Two-part control:

1. **Granularity dropdown**: `Last 7 days` · `Last 30 days` · `This week` · `This month` · `Specific week…` · `Specific month…` · `Custom range…`
2. When you pick "Specific week" or "Specific month," a second dropdown appears listing the last 12 weeks / 12 months (e.g. *Week of May 4 – May 10*, *April 2026*). "Custom range" opens a date picker.

Default: **Last 7 days** (so today's view matches what you remember seeing yesterday — currently the default 30d window dilutes recent spikes).

The selected range is stored in the URL (`?range=week-2026-W19`) so you can bookmark/share a specific week's snapshot.

### One Technical Warning for Lovable

Since you mentioned the Supabase **1000-row limit**, make sure Lovable implements **Pagination** or **Aggregate Functions** for that `analytics_events` table. If you have 50 users and they start using the "Rich Copy" feature every day, you’ll hit that 1000-row limit faster than you think.

**Instruction for Lovable:** > "When refactoring the data fetching in `AdminAnalytics.tsx`, ensure the query handles pagination or uses a count-only approach for the KPI tiles to avoid being capped by the 1000-row default."

### What the range controls

Every metric on the page recalculates against the selected window:

- All KPI tiles (Draft Acceptance, AI Attachment, Regeneration, Guest Conversion, Avg Session, Booking Conversion, SMART Suggestions, User Signups)
- Daily Events chart (x-axis adapts to the range)
- Collaboration Funnel (5-Step)
- Collaboration Outcomes (Approved / Declined / Pending / Approval Rate)
- Workspace save failures tile
- Signup Attribution
- Feature Usage Matrix (replaces the fixed 7d/30d columns with "selected range" + a comparison column for the **previous equivalent period**, so you can see week-over-week deltas)
- Inactive-credit-holders list (still based on "no login in 7+ days" but only counts users created in range)

### Comparison vs. previous period

Each KPI tile gets a small delta indicator: `15.8% ▲ +4.2pp vs prev 7d`. This is the part that directly answers "why has this dropped?" — you'll see at a glance whether it's a real drop or just a quieter day.

### Data fetching

Currently `AdminAnalytics.tsx` fetches a single `gte(created_at, thirtyDaysAgo)` slice. I'll switch it to fetch `[rangeStart, rangeEnd]` plus the previous equivalent window in one go (so deltas don't cost an extra round-trip). For ranges longer than 90 days I'll page the query to stay under Supabase's 1000-row default.

## Out of scope (flagging for later)

- Long-term retention/archival of `analytics_events` — the table will keep growing; eventually we'll want a rollup table. Not needed now, but worth a follow-up.
- Per-user drilldown — same page, future task.

## Files touched

- `src/pages/AdminAnalytics.tsx` — add range state, URL sync, refactor all `useMemo` blocks to take `(events, rangeStart, rangeEnd)`, add delta tiles.
- New `src/components/admin/AnalyticsRangePicker.tsx` — the dropdown + custom-range UI.
- New `src/lib/analytics-range.ts` — pure helpers for computing `{start, end, prevStart, prevEnd, label}` from a range key, plus tests in `src/lib/__tests__/analytics-range.test.ts` (covers week boundaries, month boundaries, DST, custom ranges).

No DB migration, no edge function changes — purely a frontend refactor of an existing admin page.