-- Fix #1: Create a public view for creators that excludes sensitive email field
-- Drop the permissive public policy
DROP POLICY IF EXISTS "Public can view creator profiles" ON public.creators;

-- Create a policy that only allows users to see their own profile
CREATE POLICY "Users can view own profile"
  ON public.creators FOR SELECT
  USING (auth.uid() = user_id);

-- Create a public view for public booking page (excludes email)
CREATE VIEW public.public_creator_profiles AS
SELECT 
  id,
  username,
  name,
  substack_url,
  bio,
  welcome_message,
  created_at
FROM public.creators;

-- Grant access to the view for anon users
GRANT SELECT ON public.public_creator_profiles TO anon;
GRANT SELECT ON public.public_creator_profiles TO authenticated;

-- Fix #3: Add DELETE policy for collab_requests so creators can remove spam
CREATE POLICY "Creators can delete own requests"
  ON public.collab_requests FOR DELETE
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));