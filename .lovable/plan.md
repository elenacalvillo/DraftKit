
## Value-Based Trial: "Free for Your First 3 Collabs"

**Status: IMPLEMENTED (v2 — Host Gate Architecture)**

### Architecture (v2)

The gate moved from "can you enter the workspace" to "can your booking page accept new requests."

```
Booking page → checks host capacity → blocks new incoming requests when at capacity
Workspace → always open for approved/published collabs (no pro gate)
Publish → gated for free users who exhausted host spots
```

### Rules

1. **Permanent Access**: Users are never locked out of a workspace they have already started or finished. All 3 default collabs are theirs forever.
2. **Host Gate**: The credit limit only applies to incoming requests on a creator's booking page. Once host spots are filled, the booking page shows an "At Capacity" message.
3. **Guest Permission**: A free user can always send a request to another writer. Their own host credit count does not restrict them from acting as a guest.
4. **Referral Credits**: When a new writer registers through an invite link (`?ref={username}`), the referrer earns 1 additional host spot via the `referral_credits` table and a DB trigger.
5. **Paid Accounts**: Paid or founder accounts have zero restrictions — unlimited host spots and requests.

### What Changed (v2)

1. **Database**: Added `referral_credits` table, `referred_by` column on `creators`, `get_host_capacity` RPC function, `award_referral_credit` trigger
2. **`usePro.ts`**: Removed `isInFreeTier`/`isPro` conflation. Now returns `hostCapacity` (limit, used, remaining, referralBonus) and `canHostMore`. `isPro` = paid/founder/trial only.
3. **`useCreatorPro.ts`**: Simplified — no longer gates workspace access. Only used for feature checks (AI drafts etc).
4. **`Workspace.tsx`**: Removed the pro gate walls entirely. Workspace is always open. Publish gate uses `canHostMore` instead of `!isPro`.
5. **`PublicBooking.tsx`**: Added capacity check via `get_host_capacity` RPC. Shows "At Capacity" message when free host has no remaining spots.
6. **`Signup.tsx`**: Captures `?ref={username}` from URL and stores `referred_by` on the new creator row. DB trigger auto-awards the referral credit.
7. **`Subscription.tsx`**: Shows dynamic host capacity (base + referral bonuses) instead of hardcoded 3. Shows referral bonus count.
8. **`Discovery.tsx`**: Invite link uses `?ref={referrerUsername}` instead of `?ref=discovery`.

### Host "Home Court" Advantage

The host has exclusive controls that guests do not:
- Generate/regenerate AI drafts
- Approve/decline requests
- Set collab link
- Mark as published
- Export controls
- Analytics/retrospective ownership
