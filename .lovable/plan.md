

## Ask for post URLs when marking as published, then auto-fetch metrics

### Problem
The current metrics are inaccurate because the edge function guesses which post is the collab post by matching dates — but for posts published weeks ago, it picks the wrong one. The "Collect engagement data" button also requires users to remember to come back and click it.

### Solution
When the creator answers "yes" to the publish check-in, show a small follow-up form asking for the actual published post URLs (creator's post + optionally the guest's post). Store these URLs on the `collab_requests` row, then automatically trigger the metrics snapshot right away — no manual button needed.

### Changes

**1. Add post URL inputs to the publish flow (`Workspace.tsx`)**
- After the creator clicks "Yes" on the retrospective publish question, show a compact form with two URL inputs: "Your post URL" and "Guest's post URL (optional)"
- Pre-fill with `collab_link` if it exists
- On submit, save URLs to `collab_requests` (use existing `collab_link` for creator URL, add a new `requester_collab_link` column) and auto-trigger `fetch-collab-metrics`

**2. Database: add `requester_collab_link` column**
- Migration: `ALTER TABLE collab_requests ADD COLUMN requester_collab_link text;`

**3. Update edge function to use exact URLs**
- In `fetch-collab-metrics`, when `collab_link` or `requester_collab_link` is set, match by slug directly instead of guessing by date
- This makes metrics accurate for any post regardless of publish timing

**4. Auto-trigger metrics on publish**
- After saving the URLs in the publish flow, call `supabase.functions.invoke("fetch-collab-metrics", { body: { requestId } })` automatically
- Remove or keep the manual "Collect engagement data" button as a fallback for cases where URLs weren't provided

### Files to change
- `src/pages/Workspace.tsx` — add URL input form after publish confirmation
- `supabase/functions/fetch-collab-metrics/index.ts` — prioritize exact URL matching via `collab_link` / `requester_collab_link`
- New migration for `requester_collab_link` column

