

## Plan: Restore missing SELECT policy on `availability` table (P0 prod)

### Root cause

The `availability` table has RLS enabled but **zero SELECT policies** — meaning every read returns 0 rows for everyone (owner, public, anonymous). Your data is **safe in the database** (I confirmed your 15 publishing dates for `elenacalvillo` and the rows for all 30+ other creators are intact), but no client can read them.

A migration on Feb 4 (`20260204232240`) created `Public can view availability for public creators` to replace an older `Public can view availability` policy. That SELECT policy was dropped at some later point and never replaced — leaving the table read-blocked.

### Symptoms (all caused by the same single bug)

- `/dashboard/availability` shows blank → user thinks dates were erased
- Public booking page shows zero open dates → guests can't book
- `Requests.tsx` approve/decline can't read current `available_dates` → date manipulation logic silently no-ops
- `Workspace.tsx` and `Dashboard.tsx` availability widgets show empty

### The fix — one migration, two policies

Recreate the two SELECT policies that the schema needs:

```sql
-- 1. Owner can read their own availability (for /dashboard/availability)
CREATE POLICY "Creators can view own availability"
ON public.availability FOR SELECT
USING (
  creator_id IN (
    SELECT id FROM public.creators WHERE user_id = auth.uid()
  )
);

-- 2. Anyone can read availability for public creator profiles (for /:username booking page)
CREATE POLICY "Public can view availability for public creators"
ON public.availability FOR SELECT
USING (
  creator_id IN (
    SELECT id FROM public.public_creator_profiles WHERE username IS NOT NULL
  )
);
```

Both policies are `permissive` so they OR together. Owners get their own row even if they later make their profile private; the public policy keeps the booking page working for guests.

### Why no data restore is needed

I queried the DB directly and confirmed:
- Your row (`elenacalvillo`) still has all 15 publishing dates, last updated `2026-04-23 04:50`
- 30+ other creators still have their full date arrays
- No DELETE happened — only the SELECT policy went missing

Once the migration runs, the existing data will become visible again **immediately**, no client code change required.

### Files

| File | Change |
|---|---|
| New SQL migration | Recreate both SELECT policies on `public.availability` |

### Out of scope (separate follow-ups, not blocking)
- Adding a unique constraint on `availability.creator_id` to prevent duplicate-row creation in the buggy "else" branch of `Availability.tsx` (low risk now that SELECT works)
- Audit other tables for the same "RLS enabled, no SELECT policy" footgun

