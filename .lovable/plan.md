# Fix: Public Booking Pages Broken for Anonymous Visitors

## The Problem (confirmed by stress test)

The recent security hardening set `public_creator_profiles` to `security_invoker=on`. Because `creators` only has an owner-scoped SELECT policy, anon visitors (`auth.uid() IS NULL`) get zero rows from the view. This cascades into `availability`, whose public-read policy joins through that view.

**User-visible impact:** Every `/{username}` and `/u/{username}` booking page on draftkit.app is blank for logged-out visitors right now. The booking calendar is also dead.

**Verified safe:** All 12 other probes (creators direct access, Stripe IDs, collab_requests PII, storage, cron-protected functions, presence, messages, roles) remain locked down.

## The Fix

One migration. No code changes — `PublicBooking.tsx` and `Availability.tsx` already query the right view/table; they just need it to return rows for anon.

### Migration: `supabase/migrations/<ts>_fix_public_profile_anon_read.sql`

```sql
-- 1. Switch the public view to security_invoker=off.
-- Safe: the SELECT list excludes every sensitive column
-- (stripe_*, credits, subscription_tier, referred_by, trial_ends_at,
-- user_id, reminder_days_before). The view IS the privacy boundary.
DROP VIEW IF EXISTS public.public_creator_profiles;
CREATE VIEW public.public_creator_profiles
WITH (security_invoker = off) AS
SELECT id, username, name, bio, substack_url, newsletter_url,
       welcome_message, profile_image_url, collab_style, collab_guidelines,
       date_meaning, collab_mode, collab_vibe, collab_formats,
       created_at, profile_theme
FROM public.creators
WHERE username IS NOT NULL;
GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;

-- 2. Repair availability's public-read policy via a SECURITY DEFINER helper
-- so policy evaluation doesn't depend on view RLS semantics.
CREATE OR REPLACE FUNCTION public.creator_has_public_profile(_creator_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creators
    WHERE id = _creator_id AND username IS NOT NULL
  );
$$;

DROP POLICY IF EXISTS "Public can view availability for public creators"
  ON public.availability;
CREATE POLICY "Public can view availability for public creators"
ON public.availability
FOR SELECT
TO anon, authenticated
USING (public.creator_has_public_profile(creator_id));
```

## Post-Migration Verification (I will run)

Re-run the same anon probes against the live REST API:

1. `GET /rest/v1/public_creator_profiles?username=eq.elenacalvillo` → expect row returned
2. `GET /rest/v1/availability?creator_id=eq.<elena_id>` → expect rows returned
3. `GET /rest/v1/creators?select=stripe_customer_id` → still 403 ✅
4. `GET /rest/v1/public_creator_profiles?select=stripe_customer_id` → still 42703 ✅
5. `GET /rest/v1/collab_requests` → still `[]` ✅
6. `POST /functions/v1/send-weekly-digest` (no secret) → still 401 ✅

## What Does NOT Change

- `creators` base-table SELECT policy (owner-only) — unchanged
- All RLS on `collab_requests`, `collaboration_messages`, `workspace_presence`, `user_roles`, `email_events`, `fulfilled_stripe_sessions` — unchanged
- Storage bucket policies — unchanged
- Cron-secret edge function gates — unchanged
- The `get_workspace_request` PII shielding for collaborators — unchanged

## Files Touched

- **NEW** `supabase/migrations/<timestamp>_fix_public_profile_anon_read.sql`

No frontend changes. No edge function changes.

Approve to switch to default mode and ship.
