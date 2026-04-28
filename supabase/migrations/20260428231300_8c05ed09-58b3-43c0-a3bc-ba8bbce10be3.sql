
-- 1. Replace view in-place (preserves dependent policies)
CREATE OR REPLACE VIEW public.public_creator_profiles
WITH (security_invoker = on) AS
SELECT
  id, username, name, bio, substack_url, newsletter_url,
  welcome_message, profile_image_url, collab_style, collab_guidelines,
  date_meaning, collab_mode, collab_vibe, collab_formats,
  created_at, profile_theme
FROM public.creators
WHERE username IS NOT NULL;

-- Public RLS policy for safe creator rows; column grants below restrict columns.
DROP POLICY IF EXISTS "Public can read public creator columns" ON public.creators;
CREATE POLICY "Public can read public creator columns"
ON public.creators
FOR SELECT
TO anon, authenticated
USING (username IS NOT NULL);

REVOKE SELECT ON public.creators FROM anon, authenticated;

GRANT SELECT (
  id, username, name, bio, substack_url, newsletter_url,
  welcome_message, profile_image_url, collab_style, collab_guidelines,
  date_meaning, collab_mode, collab_vibe, collab_formats,
  created_at, profile_theme, user_id
) ON public.creators TO anon, authenticated;

GRANT SELECT (
  stripe_customer_id, stripe_subscription_id, subscription_tier,
  trial_ends_at, credits, referred_by, reminder_days_before,
  join_directory_waitlist, updated_at
) ON public.creators TO authenticated;

GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;

-- 2. Realtime: scope to specific request topics
DROP POLICY IF EXISTS "Participants can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Scoped realtime subscriptions" ON realtime.messages;

CREATE POLICY "Scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('availability-booked-dates', 'public-booked-dates')
  OR EXISTS (
    SELECT 1
    FROM public.collab_requests cr
    LEFT JOIN public.creators c ON c.id = cr.creator_id
    LEFT JOIN public.workspace_collaborators wc
      ON wc.request_id = cr.id AND wc.user_id = (SELECT auth.uid())
    WHERE realtime.topic() LIKE '%' || cr.id::text || '%'
      AND (
        c.user_id = (SELECT auth.uid())
        OR cr.requester_user_id = (SELECT auth.uid())
        OR wc.user_id = (SELECT auth.uid())
      )
  )
);

-- 3. Storage: restrict writes to email-assets bucket
DROP POLICY IF EXISTS "Public can read email assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload email assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update email assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete email assets" ON storage.objects;

CREATE POLICY "Public can read email assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'email-assets');

CREATE POLICY "Admins can upload email assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update email assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'email-assets'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'email-assets'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete email assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'email-assets'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_collab_participant(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_request_owner(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pro_user(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_referral_credit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_request_to_existing_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_requests_to_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_collab_request() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_creator_to_resend() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_creator_collab_style() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_requester_substack_url() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
