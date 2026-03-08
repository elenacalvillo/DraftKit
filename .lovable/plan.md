

## Backfill metrics for existing published collabs

### Why nothing shows up

Two issues found after inspecting the data:

1. **Cron filter is too strict** — the batch mode in `fetch-collab-metrics` requires `retro_completed_at IS NOT NULL`, but both published collabs have `retro_completed_at = null`. The cron job silently skips them every time.

2. **Profile URLs instead of publication URLs** — the creator's Substack URL is `substack.com/@elenacalvillo` (a profile link, not a publication subdomain). The archive API only works with `username.substack.com`. Profile usernames and publication usernames can differ, so `@elenacalvillo` may not resolve to `elenacalvillo.substack.com`. Same issue with one requester URL.

### Plan

**1. Fix the edge function filter** (`supabase/functions/fetch-collab-metrics/index.ts`)
- Remove the `.not("retro_completed_at", "is", null)` filter in cron mode — just query all `status = 'published'` requests
- Use `approved_at` or `created_at` as fallback date when `retro_completed_at` is null

**2. Add profile-to-publication resolution** (same edge function)
- When a Substack URL is a profile format (`@username`), first try fetching `username.substack.com/api/v1/archive` directly
- If that 404s, try fetching the profile page and extracting the publication subdomain from the redirect or metadata
- This makes the function resilient to both URL formats already stored in the DB

**3. Add a manual "Refresh Metrics" button** (`CollabImpactCard.tsx`)
- When no metrics exist yet for a published collab, show a "Collect engagement data" button that calls `useTriggerMetricsSnapshot`
- This lets you (and any creator) trigger the first snapshot on demand without waiting for the cron
- After the snapshot completes, auto-refetch the query to display results

**4. Trigger backfill for existing published collabs**
- After deploying the fixed edge function, invoke it once for each existing published request to populate initial data

### Files to change
- `supabase/functions/fetch-collab-metrics/index.ts` — relax filter, add profile URL resolution
- `src/components/requests/CollabImpactCard.tsx` — add empty state with manual trigger button
- `src/hooks/useCollabMetrics.ts` — wire up the trigger with query invalidation

