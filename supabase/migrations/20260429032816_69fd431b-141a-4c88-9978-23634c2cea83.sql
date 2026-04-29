-- Drop the dependent policy FIRST so we can recreate the view.
DROP POLICY IF EXISTS "Public can view availability for public creators"
  ON public.availability;

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

-- SECURITY DEFINER helper so the policy doesn't depend on view RLS semantics.
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

CREATE POLICY "Public can view availability for public creators"
ON public.availability
FOR SELECT
TO anon, authenticated
USING (public.creator_has_public_profile(creator_id));