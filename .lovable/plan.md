## Fix: "Failed to submit request" on Public Booking

### Root Cause Analysis

There are two interacting bugs that cause the insert into `collab_requests` to fail silently:

**Bug 1: Stale Auth Session**
When a user is logged into DraftKit and visits a booking page, the React state has `user.id` set. The code passes `requester_user_id: user.id` in the insert. But if their auth token expires while filling out the form (common on mobile where browsers aggressively suspend tabs), the Supabase request goes out as `anon`. The RLS policy then sees `auth.uid() IS NULL` but `requester_user_id IS NOT NULL` -- both policy branches fail, and the insert is denied.

This matches Dinah's scenario: she's likely logged in (she has a codelikeagirl account), on mobile, filling out a form on her own booking page. Her session expired mid-form, the code still thinks she's logged in, and the insert fails.

**Bug 2: Trigger + RLS Conflict (ticking time bomb)**
The `link_request_to_existing_user` trigger fires BEFORE INSERT and sets `requester_user_id` if the requester's email matches a `creator_contacts` entry. But if the requester is anonymous, this breaks the same RLS condition. Any anonymous visitor who uses an email that belongs to an existing creator will get "Failed to submit."

**Bug 3: No error logging**
The error object from the failed insert is never logged, making debugging impossible.

### Implementation Plan

**1. Fix the frontend code** (`src/pages/PublicBooking.tsx`)

- Before the insert, re-check if the user session is still valid by calling `supabase.auth.getSession()`
- Only set `requester_user_id` if the session is confirmed valid
- Add `console.error("Insert error:", JSON.stringify(error))` when the insert fails
- If the insert fails with a non-23505 error, retry once with `requester_user_id: null` as a fallback

**2. Fix the database trigger** (migration)

- Modify `link_request_to_existing_user` to only set `requester_user_id` when `auth.uid() IS NOT NULL`
- This prevents the trigger from violating RLS for anonymous users

### The Fix: "Account Neutrality"

We need to strip the "identity guessing" out of the booking flow. Whether Karen has an account or not should be **irrelevant** to the success of the form submission.

**The plan for Lovable is now crystal clear:**

1. **Kill the Auto-Link:** Modify the `link_request_to_existing_user` trigger. It should **NEVER** try to guess a `user_id` for a guest. Guests should always be saved as guests (`requester_user_id = NULL`).
2. **Frontend Silence:** In `PublicBooking.tsx`, we explicitly pass `requester_user_id: null` unless the user is actively logged in with a verified session.
3. **The "Reconciliation" (Later):** When Karen eventually logs in or creates her account, she will see her "Guest" requests because we will match them by her **email**, not by a hidden ID that broke the form.

---

### Why this is a "Product-Led" Win

By making the booking form **"Account Blind,"** you ensure that zero friction exists for the person trying to book. You want the "Yes" to happen as fast as possible. You can deal with the "User Account" logic after the collaboration is already agreed upon.

### Files Modified

- `src/pages/PublicBooking.tsx` -- session validation + error logging + retry logic
- Database migration -- update `link_request_to_existing_user` trigger function