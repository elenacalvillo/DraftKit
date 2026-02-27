

## Investigation Results

**Triggers ARE active** on `collab_requests` (contrary to what the schema info showed). Two triggers fire on every insert:
1. `trg_link_request_to_existing_user` — the one we fixed
2. `trg_validate_requester_url` — validates Substack URL format

**The trigger function IS updated** — confirmed via direct database query. The fix is live server-side.

**No recent test row exists** — querying for `elenacalvilloalcalde@gmail.com` shows only one request from January 16. Your test today did not insert.

### Most likely cause

You tested on the **published site** (`collabstack.lovable.app`), which still has the **old frontend code** (before our fix). The published site needs a new deployment to pick up the code changes. The database trigger fix IS live, but the frontend retry logic is only in the preview.

### The real fix: True Account Blindness

The current code is too clever — it validates the session, sets `requester_user_id` if valid, and retries if it fails. This creates unnecessary complexity. The simpler approach:

**Always send `requester_user_id: null` from the public booking page.** Period. No session checking. No retry. The booking form should never care who you are.

### Changes

**`src/pages/PublicBooking.tsx`**:
- Remove the `supabase.auth.getSession()` call before insert
- Remove the retry-as-anonymous fallback block
- Hardcode `requester_user_id: null` in the insert payload
- Keep the error logging

This is 3 lines of code instead of 15. The `link_requests_to_new_user` trigger (which fires when a user signs up) already handles reconciliation by matching email — so no data is lost.

