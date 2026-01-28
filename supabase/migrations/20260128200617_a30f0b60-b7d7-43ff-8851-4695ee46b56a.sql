-- Fix the security definer view issue by making it security invoker
DROP VIEW IF EXISTS public.public_creator_profiles;
CREATE VIEW public.public_creator_profiles
WITH (security_invoker = true)
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
  created_at
FROM public.creators;