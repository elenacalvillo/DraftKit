

# Fix: Discovery fetching wrong Substack URL + Refresh button stuck

## Root Cause

**Problem 1 -- Wrong URL**: The edge function reads `creator.substack_url` which is `https://substack.com/@elenacalvillo` (a profile URL). `extractSubdomain` returns `elenacalvillo`, so it fetches `https://elenacalvillo.substack.com/recommendations` -- a non-existent publication. Your actual publication subdomain is `productreleasenotes` (stored in `newsletter_url`).

**Problem 2 -- Refresh locked**: After the first fetch (even with 0 results), `setLastFetchedAt(Date.now())` fires, disabling the button for 1 hour.

## Fix

### Edge Function (`supabase/functions/fetch-substack-recommendations/index.ts`)

- Change the query to also select `newsletter_url`
- Use `newsletter_url` as the primary source for the subdomain (it's always a publication URL like `productreleasenotes.substack.com`)
- Fall back to `substack_url` only if `newsletter_url` is not set
- This respects the existing validation rule that profile URLs (`substack.com/@...`) lack RSS/recommendation data

### Discovery Page (`src/pages/Discovery.tsx`)

- Only set `lastFetchedAt` when the fetch actually returns results (`data.recommendations.length > 0`)
- Allow refresh immediately if the previous fetch returned 0 results or an error
- This way the user isn't locked out after a failed/empty fetch

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/fetch-substack-recommendations/index.ts` | Select `newsletter_url`, prefer it over `substack_url` for subdomain extraction |
| `src/pages/Discovery.tsx` | Only lock refresh cooldown when results were actually found |

