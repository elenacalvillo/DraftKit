# Fix the Collab Engine: Host Gate, Workspace Access, Referral Credits

## The Problem (3 issues)

1. **Workspace lockout**: `useCreatorPro` does not include free-tier logic. A free user with 0 published collabs gets `isHostPro = false`, blocking them from ALL workspaces immediately. The workspace should always be accessible for existing approved/published collabs.
2. **No booking page gate**: There is zero capacity check on the public booking page. A free user who has used all 3 host spots can still receive unlimited requests. The gate should be on INCOMING requests, not workspace access.
3. **No referral backend**: Landing copy promises "earn a collaboration credit" but there is no `referral_credits` table, no invite link tracking, and `FREE_COLLAB_LIMIT` is hardcoded to 3.

## Architecture Change

The gate moves from "can you enter the workspace" to "can your booking page accept new requests."

```text
BEFORE:
  Workspace → checks isHostPro → blocks free users from their own work

AFTER:
  Booking page → checks host capacity → blocks new incoming requests
  Workspace → always open for approved/published collabs (no pro gate)
  Publish → still gated for free users who exhausted credits
```

## Implementation Plan

### 1. New DB table: `referral_credits`

Track who invited whom and award host spots.

```sql
CREATE TABLE public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_user_id, referred_user_id)
);

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

-- Users can see their own referral credits
CREATE POLICY "Users can view own referrals"
ON public.referral_credits FOR SELECT TO authenticated
USING (referrer_user_id = auth.uid());
```

### 2. Add `referred_by` column to `creators`

When a new user signs up via `?ref={username}`, store who referred them.

```sql
ALTER TABLE public.creators ADD COLUMN referred_by uuid REFERENCES auth.users(id);
```

### 3. DB function: `get_host_capacity`

Returns how many host spots a creator has (3 + referral count) and how many are used.

```sql
CREATE OR REPLACE FUNCTION public.get_host_capacity(_creator_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'base_limit', 3,
    'referral_bonus', (
      SELECT count(*) FROM referral_credits
      WHERE referrer_user_id = (SELECT user_id FROM creators WHERE id = _creator_id)
    ),
    'used', (
      SELECT count(*) FROM collab_requests
      WHERE creator_id = _creator_id AND status IN ('approved', 'published')
    )
  )
$$;
```

### 4. DB trigger: award referral credit on signup

When a new creator row is inserted with `referred_by`, insert a row into `referral_credits` for both the referrer and the new user.

### 5. Rewrite `usePro.ts`

Remove the `isInFreeTier`/`isPro` conflation. Instead return:

- `isPaidOrFounder`: has role or subscription
- `hostCapacity`: `{ limit, used, remaining }` (calls `get_host_capacity`)
- `canHostMore`: `isPaidOrFounder || remaining > 0`
- `isPro` stays true for paid/founder/trial only (no more "free tier = pro" hack)

### 6. Rewrite `useCreatorPro.ts`

Add the same capacity logic so workspace access works for free-tier hosts:

- Paid/founder/trial: `isPro = true` (unlimited)
- Free tier: always return `isPro = true` (workspace is always open)
- Remove the workspace gate entirely from this hook. The workspace is not the paywall surface.

Actually, simpler: **Remove the workspace pro gate entirely.** The workspace should always be accessible for approved/published collabs regardless of tier. The gate surfaces are:

- Booking page (incoming requests)
- Publish action (already exists)

### 7. `Workspace.tsx` changes

- **Remove** the `useCreatorPro` import and the `effectiveCanEdit` gate (lines 378-477)
- **Keep** the publish gate in `handlePublishAnswer` but update it to check `canHostMore` instead of `!isPro`
- Host retains "home court" advantages: export controls, analytics ownership, shared room permissions (these already exist as creator-only UI)

### 8. `PublicBooking.tsx` changes

- After loading creator, call `get_host_capacity` RPC
- If `remaining <= 0` AND creator is not paid/founder, show a message: 
  - **Headline:** You are currently at capacity for new collaborations.
  - **Body:** You have reached the limit for incoming requests right now. Please check back later or reach out on Substack to coordinate.
  - **The Footer Link:** [Manage this page] (goes to upgrade their accounts to become paid)
- Paid creators: no capacity check

### 9. Signup flow: capture `?ref` parameter

- In `Signup.tsx`, read `?ref={username}` from URL
- After successful signup + creator profile creation, look up the referrer's `user_id` from the `creators` table by username
- Set `referred_by` on the new creator row
- The DB trigger handles awarding the credit

### 10. `Subscription.tsx` changes

- Update the free-tier progress bar to show host capacity (3 + referral bonuses) instead of just published count
- Show referral count: "You've earned X bonus spots by inviting friends"

### 11. `Discovery.tsx` invite link

- Change invite link from `/{username}?ref=discovery` to `/{username}?ref={referrerUsername}` so the referral can be tracked

### 12. Landing page copy

No changes needed. The copy already promises credits and the backend will now deliver.

## Host "Home Court" Advantage (already exists)

The host already has exclusive controls that guests do not:

- Generate/regenerate AI drafts
- Approve/decline requests
- Set collab link
- Mark as published
- Export controls
- Analytics/retrospective ownership

These naturally incentivize hosting over always being a guest.

## Files Changed


| File                            | Change                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Migration SQL                   | New `referral_credits` table, `referred_by` column, `get_host_capacity` function, signup trigger |
| `src/hooks/usePro.ts`           | Add `hostCapacity` fields, remove `isInFreeTier = isPro` hack                                    |
| `src/hooks/useCreatorPro.ts`    | Simplify or remove (no longer needed for workspace gate)                                         |
| `src/pages/Workspace.tsx`       | Remove pro gate walls, keep publish gate                                                         |
| `src/pages/PublicBooking.tsx`   | Add host capacity check, show "at capacity" message                                              |
| `src/pages/Signup.tsx`          | Capture `?ref` param, store `referred_by`                                                        |
| `src/pages/Subscription.tsx`    | Show capacity with referral bonuses                                                              |
| `src/pages/Discovery.tsx`       | Use referrer username in invite link                                                             |
| `src/hooks/useActiveCollabs.ts` | May be simplified or merged into usePro                                                          |
