
# Simplify `useCreatorPro`: Drop `has_role` RPC, Use `subscription_tier` Only

## The Problem

The current `useCreatorPro` hook makes two sequential network calls:
1. Fetch `subscription_tier`, `trial_ends_at`, and `user_id` from `creators`
2. Call `has_role(_user_id, 'pro')` with the **host's** `user_id`

The second call is the issue. The `has_role` RPC is a `SECURITY DEFINER` function built to check whether the **currently authenticated user** has a role — it accepts any `_user_id` as a parameter, so it works today, but a guest client is handing it the host's `user_id`, which is semantically incorrect and a potential point of failure if permissions are ever tightened.

More importantly: it's unnecessary. The `creators` table already has `subscription_tier` (values: `'free'` or `'pro'`) and `trial_ends_at`, which are publicly readable whenever `username IS NOT NULL`. Manual Pro grants (lifetime deals, early adopters) are administered by setting `subscription_tier = 'pro'` or inserting into `user_roles` — either way, the `subscription_tier` column is the source of truth for the UI.

## The Fix

Remove the `has_role` RPC call entirely. The query becomes a single read against `creators` checking two columns. This is:
- Faster (one round-trip instead of two)
- Permission-safe (no cross-user RPC call)
- Correct for all current Pro grant paths

## Technical Details

**File:** `src/hooks/useCreatorPro.ts`

Remove the `user_id` from the SELECT (no longer needed), remove the `has_role` fallback, and simplify the return logic to just `subscription_tier` and `trial_ends_at`.

Before:
```
.select("user_id, subscription_tier, trial_ends_at")
→ check tier + trial
→ if false, call has_role(host_user_id, 'pro')
```

After:
```
.select("subscription_tier, trial_ends_at")
→ check tier + trial only
```

No changes to `Workspace.tsx` or any other file — only `useCreatorPro.ts` is touched.

## Note on Manual Pro Grants

The `user_roles` table with role `'pro'` is reserved for role-based access that supplements the `subscription_tier` column (e.g. the `is_pro_user()` database function also checks it). For the **workspace UI gate specifically**, checking `subscription_tier` is the right and sufficient signal. If a manual grant ever needs to override the UI, the admin can also set `subscription_tier = 'pro'` on the `creators` row, which is already the correct pattern.

## Summary

| Before | After |
|--------|-------|
| 2 network calls (creators + has_role RPC) | 1 network call (creators only) |
| Passes host's user_id to a self-checking RPC | No cross-user RPC call |
| `select("user_id, subscription_tier, trial_ends_at")` | `select("subscription_tier, trial_ends_at")` |

One file changed, five lines removed.
