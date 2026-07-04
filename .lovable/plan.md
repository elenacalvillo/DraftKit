## The real problem

SheWritesAI is already a **paying Project-tier** subscriber (`creators.subscription_tier = 'project'`).

But the Postgres function `get_host_capacity` — the source of truth for the "At Capacity" screen on `draftkit.app/<username>` — only recognizes `subscription_tier = 'pro'` as Pro. Project tier is invisible to it, so:

- She's counted against the Free 3-credit host cap.
- Once 3 approved/published collabs exist, every new incoming booking (like Hollie's) is blocked with "At Capacity".
- Every other Project-tier host on the platform has the same silent block.

The app-side `hasProAccess()` treats `'pro'` and `'project'` as equivalent. The DB function is out of sync.

## Fix

Migration to replace `get_host_capacity` so `is_pro` returns true when ANY of:

- `user_roles` has role `'pro'` for the creator's user (Founding Member / VIP grants), OR
- `creators.subscription_tier IN ('pro', 'project')`, OR
- `creators.trial_ends_at > NOW()`.

No other logic changes. `base_limit`, `referral_bonus`, and `used` stay identical. Signature, return shape, `SECURITY DEFINER`, and `search_path` unchanged.

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.get_host_capacity(_creator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'base_limit', 3,
    'referral_bonus', (
      SELECT count(*)::int FROM referral_credits
      WHERE referrer_user_id = (SELECT user_id FROM creators WHERE id = _creator_id)
    ),
    'used', (
      SELECT count(*)::int FROM collab_requests
      WHERE creator_id = _creator_id
        AND status IN ('approved', 'published')
        AND is_project_workspace = false
    ),
    'is_pro', (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = (SELECT user_id FROM creators WHERE id = _creator_id)
          AND role = 'pro'
      )
      OR EXISTS (
        SELECT 1 FROM creators
        WHERE id = _creator_id
          AND subscription_tier IN ('pro', 'project')
      )
      OR EXISTS (
        SELECT 1 FROM creators
        WHERE id = _creator_id
          AND trial_ends_at > NOW()
      )
    )
  )
$function$;
```

## Verification

1. Run the migration.
2. Query the RPC for her creator id and confirm `is_pro = true`:
   `SELECT public.get_host_capacity('4c575634-453d-4c92-afd4-180d3411037e');`
3. Hollie can immediately reload `draftkit.app/shewritesai` — the "At Capacity" screen is gone.

## Not doing

- **No frontend change.** `PublicBooking.tsx` and `usePro` already interpret `cap.is_pro` correctly.
- **No comping / user_roles grant.** She's already paying for Project tier.
- **No credit-cap bump.** The cap is correct for Free; the bug is misidentifying her tier.

## What to tell Karen / Hollie

Once the fix ships: "Fixed — SheWritesAI's booking page is open again. Hollie can submit her guest post request now."

## Follow-up worth considering (out of scope for this change)

Grep the DB and edge functions for other places comparing `subscription_tier = 'pro'` literally; any of them will drop Project-tier users. Worth a scan in a separate task.
