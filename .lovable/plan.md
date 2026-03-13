

# Value-Based Trial: "Free for Your First 3 Collabs"

## Concept

Replace the time-based 7-day trial with a usage-based model: every new user gets full Pro features until they've published 3 collaborations. After that, they hit the paywall. Founding members and paid Pro users are completely unaffected.

## How It Works Today

- `set_founder_trial()` trigger gives new creators `subscription_tier = 'pro'` and `trial_ends_at = NOW() + 7 days`
- `usePro()` checks: has `pro` role (founders) OR `subscription_tier = 'pro'` OR `trial_ends_at > now()`
- `useActiveCollabs()` limits free users to 1 active (approved) collab at a time
- The Subscription page shows "X days left" for trial users

## Changes

### 1. Database Migration

- Remove the `set_founder_trial()` trigger so new signups no longer get a time-based trial
- Instead, new creators start with `subscription_tier = 'free'` and `trial_ends_at = NULL`
- No new columns needed -- we count published collabs dynamically from `collab_requests` where `status = 'published'`

```sql
-- Drop the time-based trial trigger
DROP TRIGGER IF EXISTS creator_founder_trial ON public.creators;
DROP FUNCTION IF EXISTS public.set_founder_trial();
```

### 2. Update `usePro()` hook

Add a `publishedCount` query. The new logic:

- **Founders** (has `pro` role): always Pro, unchanged
- **Paid subscribers** (`subscription_tier = 'pro'`): always Pro, unchanged
- **Legacy trial users** (existing `trial_ends_at` still in future): still honored until expiry
- **Everyone else**: Pro if `publishedCount < 3`

New return values: `publishedCount`, `freeCollabsRemaining` (3 - publishedCount), `isInFreeTier` (true when using the 3-collab allowance)

### 3. Update `useActiveCollabs()` hook

Change `FREE_TIER_LIMIT` from 1 to 3, but the limit now applies to **published** collabs (not active/approved). Free users can have unlimited *active* collabs but hit the wall when trying to publish their 4th.

Actually, re-reading the current logic: `useActiveCollabs` gates *approving* new collabs. The new model should let free users approve freely but gate at the publish step. So:
- `canApprove` = always true for free-tier users (they can collaborate)
- The paywall triggers when they try to **publish** collab #4

### 4. Update `Subscription.tsx` (Membership page)

**View B (Free users):**
- Replace "X days left" trial banner with a progress indicator: "2 of 3 free collaborations used"
- Update copy from "Professional tools for serious newsletter collaborators" to "Free to start. Upgrade when you're ready."
- CTA text: "Unlock Unlimited Collabs"

**View A (Pro users):** No changes -- founders and paid subscribers see the same recognition page.

### 5. Update `UpgradePrompt.tsx`

Update the `collabs` feature copy to reflect "You've used your 3 free collaborations" instead of the generic limit message.

### 6. Gate the publish action

In `Requests.tsx` (or wherever the "mark as published" action lives), check `publishedCount >= 3 && !isPro` before allowing the status change. Show a toast with upgrade CTA if blocked.

## Files to Modify

| File | Change |
|---|---|
| Migration SQL | Drop `set_founder_trial` trigger |
| `src/hooks/usePro.ts` | Add published count query, new `isInFreeTier` / `freeCollabsRemaining` fields |
| `src/hooks/useActiveCollabs.ts` | Remove the 1-collab approval gate for free users (let them approve freely) |
| `src/pages/Subscription.tsx` | Replace trial banner with collab progress, update copy |
| `src/pages/Requests.tsx` | Gate publish action at 3 collabs for non-Pro |
| `src/components/subscription/UpgradePrompt.tsx` | Update collabs copy |

## Safety: Existing Users

- Founders with `pro` role: completely untouched, `has_role` check runs first
- Users with existing `trial_ends_at` in the future: still honored (legacy path preserved in `usePro`)
- Paid subscribers: `subscription_tier = 'pro'` path unchanged

