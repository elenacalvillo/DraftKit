

## Value-Based Trial: "Free for Your First 3 Collabs"

**Status: IMPLEMENTED**

Replaced the 7-day time-based trial with a usage-based model: every new user gets full Pro features until they've published 3 collaborations. After that, they hit the paywall. Founding members and paid Pro users are completely unaffected.

### What Changed

1. **Database**: Dropped `set_founder_trial()` trigger — new signups start as `free` with no trial period
2. **`usePro.ts`**: Counts published collabs dynamically; returns `publishedCount`, `freeCollabsRemaining`, `isInFreeTier`; Pro = founder OR paid OR legacy trial OR < 3 published
3. **`useActiveCollabs.ts`**: Removed 1-collab approval gate — free users can approve unlimited collabs; gate is at publish step
4. **`Subscription.tsx`**: Free-tier users see collab progress bar ("2 of 3 free collaborations used"); CTA = "Unlock Unlimited Collabs"; legacy trial banner still shown for existing trial users
5. **`Workspace.tsx`**: `handlePublishAnswer("yes")` checks `!isPro` and blocks with upgrade toast if at limit; recovery "Mark as Published" button also gated
6. **`UpgradePrompt.tsx`**: Updated collabs copy to "You've used your 3 free collaborations"

### Safety

- Founders (`pro` role): untouched — `has_role` check runs first
- Paid subscribers (`subscription_tier = 'pro'`): untouched
- Legacy trial users (existing `trial_ends_at` in future): still honored
