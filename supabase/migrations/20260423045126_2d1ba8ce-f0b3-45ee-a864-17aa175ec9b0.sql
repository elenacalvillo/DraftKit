DROP VIEW IF EXISTS public.public_creator_profiles CASCADE;

CREATE VIEW public.public_creator_profiles
WITH (security_invoker = on)
AS
SELECT
  id,
  username,
  name,
  bio,
  substack_url,
  newsletter_url,
  welcome_message,
  profile_image_url,
  collab_style,
  collab_guidelines,
  date_meaning,
  collab_mode,
  collab_vibe,
  collab_formats,
  created_at,
  profile_theme
FROM public.creators;

GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;