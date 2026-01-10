-- Fix the public_creator_profiles view to use SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS public_creator_profiles;
CREATE VIEW public_creator_profiles WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  name,
  bio,
  newsletter_url,
  substack_url,
  welcome_message,
  profile_image_url,
  created_at
FROM creators;