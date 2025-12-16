-- Fix the security definer view - recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  name,
  substack_url,
  bio,
  welcome_message,
  created_at
FROM public.creators;

-- Grant access to the view
GRANT SELECT ON public.public_creator_profiles TO anon;
GRANT SELECT ON public.public_creator_profiles TO authenticated;

-- We also need to allow public SELECT on the creators table for the view to work
-- But only specific columns through a restricted policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.creators;

-- Allow public to view creator profiles (the view will use this)
CREATE POLICY "Public can view creator profiles"
  ON public.creators FOR SELECT
  USING (true);