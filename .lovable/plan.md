## What's actually happening

The user is logged in as `hello@elenacalvillo.com` and sitting on `/dashboard`. Their `creators` row is fully populated, so the suspected `dashboard ↔ signup` redirect loop is **not** what's firing — `ProtectedRoute` lets them through and `Signup`'s effect only redirects when `user && creator`. No route bounce is happening for this account.

What network traffic actually shows (sampled 16:40:34–16:40:37):

```text
GET /creators?select=*&user_id=eq.<self>            ← every ~1s, sometimes 2× same second
GET /creators?select=user_id,profile_image_url&...  ← every ~1s, in bursts of 2–4
```

So two things are looping in lockstep:

1. `useAuth.fetchCreator` — runs whenever `onAuthStateChange` fires. The `select=*` query is its signature.
2. `Dashboard.fetchData` — `useEffect(..., [creator])`. Because `fetchCreator` replaces `creator` with a brand-new object reference each run, the effect re-fires, which then issues the `select=user_id,profile_image_url&user_id=in.(...)` batch image-resolution query for the same 3 collab requester IDs.

So the root chain is: **something is firing `onAuthStateChange` on a ~1 Hz cadence**, which thrashes `creator`, which thrashes the Dashboard effect, which thrashes the UI (the "flicker"). The new ghost-recovery migration/edge function did not touch auth or RLS on `creators`, so the regression is in client code, not the backend.

## Plan

1. **Confirm the trigger** (1 file read, no edits)
   - Add a single temporary `console.log("[auth]", event)` inside `onAuthStateChange` in `src/hooks/useAuth.tsx`, reload `/dashboard`, capture console. Expect to see `TOKEN_REFRESHED` or `INITIAL_SESSION` firing repeatedly. This pins the source before we touch logic.

2. **Stop reacting to no-op auth events** in `src/hooks/useAuth.tsx`
   - In the `onAuthStateChange` callback, only call `fetchCreator` when the `session.user.id` actually changed compared to the previous value (track via `useRef`). `TOKEN_REFRESHED` and tab-sync events keep the same user id → skip the refetch.
   - Keep the initial `getSession()` path as the single source of the first `fetchCreator` call.
   - Same guard for clearing `creator`: only `setCreator(null)` on a true sign-out transition, not on every event with no user.

3. **Stabilise the `creator` reference** so consumers don't churn even if `fetchCreator` does run
   - In `fetchCreator`, after the query returns, compare the new row to the previous `creator` (shallow compare on the handful of fields we actually read) and **reuse the prior reference** when nothing changed. This makes the Dashboard `useEffect([creator])` and `usePro`'s `queryKey: [..., creator?.id]` immune to identity-only updates.

4. **Tighten the Dashboard effect** in `src/pages/Dashboard.tsx`
   - Change `useEffect(..., [creator])` to depend on `creator?.id` instead of the full object. Defensive belt-and-braces fix in case any other path produces a new `creator` reference with the same data.

5. **Verify**
   - Reload `/dashboard`, watch network: `creators?select=*` should fire once on mount, then not at all until a real auth change. The image-resolution `IN` query should fire once per `requests` payload, not every second.
   - Remove the temporary `console.log` from step 1.

## Out of scope

- Ghost-recovery edge function, migration, or `recovery_emails_sent` table — unrelated to this flicker.
- Any change to `ProtectedRoute` / `Signup` redirect logic — those are not in the loop for this user. We'll only revisit them if step 1 shows the trigger is actually a route bounce on a *different* account (e.g. one of the 18 backfilled ghosts whose `creator` row exists but is empty).
