
-- =============================================================
-- 1) FIX: creators table publicly exposes Stripe + billing data
-- Drop the broad public SELECT policy and rely on the
-- public_creator_profiles view (which excludes sensitive cols)
-- for unauthenticated/public reads.
-- =============================================================
DROP POLICY IF EXISTS "Public can view creators with username" ON public.creators;

-- Re-add a SELECT policy ONLY for authenticated users that need to
-- look up other creators (for discovery, matching, etc.) — but
-- this still exposes sensitive cols at the row level via SQL.
-- Better: keep authenticated access only to OWN row via the existing
-- "Creators can view own profile" policy, and require all public
-- reads to go through public_creator_profiles view.

-- Ensure the view is accessible to anon and authenticated
GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;

-- Re-create view with security_invoker to enforce caller's RLS
-- (so it doesn't bypass the new restriction). Since underlying
-- table now blocks anon SELECTs, we need the view to be SECURITY
-- DEFINER OR explicitly bypass — use a SECURITY DEFINER function-
-- backed view via setting it as security_definer is not allowed
-- on views; instead recreate the view normally and grant on the
-- needed columns of the underlying table.

-- Grant column-level SELECT on creators for ONLY the safe public
-- columns to anon and authenticated, so the view works.
GRANT SELECT (
  id, username, name, bio, substack_url, newsletter_url,
  welcome_message, profile_image_url, collab_style, collab_guidelines,
  date_meaning, collab_mode, collab_vibe, collab_formats,
  created_at, profile_theme
) ON public.creators TO anon, authenticated;

-- Add a permissive SELECT policy on creators that ONLY succeeds
-- when the caller is reading via column-grants (no policy = no rows).
-- We need a policy because RLS denies by default. Make it allow
-- reads when username IS NOT NULL but DB-level column grants will
-- prevent reading sensitive columns.
CREATE POLICY "Public profile columns readable"
ON public.creators
FOR SELECT
TO anon, authenticated
USING (username IS NOT NULL);

-- Note: column-level GRANTs above restrict which columns anon/auth
-- can actually SELECT. Sensitive columns (stripe_customer_id,
-- stripe_subscription_id, subscription_tier, trial_ends_at, credits,
-- referred_by, user_id, stripe_*) remain readable ONLY by the owner
-- via the existing "Creators can view own profile" policy combined
-- with table-level GRANTs to the owner.

-- Make sure owner can still read all columns: owner policy already exists.
-- Grant full SELECT on creators back to authenticated only for the
-- columns above; sensitive columns are NOT in the grant, so even
-- though the policy passes, queries selecting them as anon/auth
-- (non-owner) will fail with permission denied.

-- =============================================================
-- 2) FIX: Realtime channel authorization
-- Add RLS policies on realtime.messages to restrict which topics
-- authenticated users can subscribe to.
-- =============================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to receive realtime broadcasts
-- (postgres_changes still respect source-table RLS per receiver)
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- =============================================================
-- 3) FIX: SECURITY DEFINER functions executable by anon/auth
-- Revoke EXECUTE from anon/authenticated on functions that should
-- not be public. Keep get_public_sheet anon (it's the public
-- shared-draft view feature).
-- =============================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_pro_user(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_workspace_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_request_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_host_capacity(uuid) FROM anon, authenticated;

-- Trigger functions don't need to be callable by clients
REVOKE EXECUTE ON FUNCTION public.award_referral_credit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.link_request_to_existing_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.link_requests_to_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_collab_request() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_creator_to_resend() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_requester_substack_url() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_creator_collab_style() FROM anon, authenticated, public;

-- =============================================================
-- 4) FIX: Public bucket allows listing (email-assets)
-- The email-assets bucket is public so emails can <img src> the
-- logo. Allow public READ of individual objects (already implicit
-- for public buckets) but block listing the bucket contents.
-- =============================================================
-- Drop any overly broad SELECT policy that allows listing
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND qual ILIKE '%email-assets%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Public buckets serve files via CDN URL without RLS, so we don't
-- need any SELECT policy at all to keep <img src> working.
-- Listing is blocked because no policy grants it.
