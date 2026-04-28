
-- 1) Drop the zombie permissive policy
DROP POLICY IF EXISTS "Public profile columns readable" ON public.creators;

-- Revoke wide column grants from anon (no longer needed)
REVOKE SELECT ON public.creators FROM anon;

-- 2) Replace the view in place to set security_invoker=off so it
--    bypasses RLS for the whitelisted columns. CREATE OR REPLACE
--    avoids the dependency error from DROP.
CREATE OR REPLACE VIEW public.public_creator_profiles
WITH (security_invoker = off) AS
SELECT
  id, username, name, bio, substack_url, newsletter_url,
  welcome_message, profile_image_url, collab_style, collab_guidelines,
  date_meaning, collab_mode, collab_vibe, collab_formats,
  created_at, profile_theme
FROM public.creators
WHERE username IS NOT NULL;

GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;

-- 3) Helper for signup referrer lookup
CREATE OR REPLACE FUNCTION public.get_user_id_by_username(_username text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.creators
  WHERE username = _username
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_username(text) TO authenticated;

-- 4) Realtime: scoped policy
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;

CREATE OR REPLACE FUNCTION public.is_collab_participant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.creators WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.collab_requests WHERE requester_user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.workspace_collaborators WHERE user_id = _user_id);
$$;

REVOKE ALL ON FUNCTION public.is_collab_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_collab_participant(uuid) TO authenticated;

CREATE POLICY "Participants can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_collab_participant((SELECT auth.uid())));
