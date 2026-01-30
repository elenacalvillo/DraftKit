-- Recreate public_creator_profiles view with SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS public_creator_profiles;

CREATE VIEW public_creator_profiles WITH (security_invoker = on) AS
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
  created_at,
  profile_theme
FROM creators;