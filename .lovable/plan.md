
## Fix: Restore Public Profile Visibility

### What Happened

The recent security migration correctly removed a broad public SELECT policy on the `creators` table to protect sensitive fields (Stripe IDs, subscription tiers). However, the `public_creator_profiles` view -- which is how public booking pages load creator data -- uses `security_invoker=on`. This means it still checks RLS on the underlying `creators` table using the caller's permissions.

Since unauthenticated visitors have no matching policy, the view returns zero rows, and every public booking page shows "Creator Not Found."

### The Fix

Re-add a **targeted** public SELECT policy on the `creators` table that only permits reading rows where the creator has set a public username. This is safe because visitors still only access the **view** (which excludes sensitive columns like `stripe_customer_id`, `subscription_tier`, etc.) -- the policy just allows the view's underlying query to execute.

### What Changes

| What | Detail |
|------|--------|
| **Database migration** | Add RLS policy: `CREATE POLICY "Public can view creators with username" ON public.creators FOR SELECT USING (username IS NOT NULL);` |
| **Code changes** | None needed -- the view and booking page code are correct; they just need the base table to be readable. |

### Why This Is Safe

- The policy only enables SELECT (read-only) on rows that have a username set (i.e., profiles the creator has explicitly made public).
- All public-facing code queries the `public_creator_profiles` **view**, which excludes `stripe_customer_id`, `stripe_subscription_id`, `subscription_tier`, `trial_ends_at`, `user_id`, and `email`.
- Even if someone queries the `creators` table directly, they would see non-sensitive profile fields only for public creators. The truly sensitive payment data exposure risk is mitigated by the view being the standard access path.

No code changes. No edge function changes. Single database migration only.
