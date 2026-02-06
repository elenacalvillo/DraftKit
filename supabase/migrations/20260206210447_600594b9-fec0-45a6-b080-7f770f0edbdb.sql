-- Allow public access to creator profiles that have a username set
-- The public_creator_profiles view already filters out sensitive data (email)
CREATE POLICY "Public can view public creator profiles"
ON public.creators
FOR SELECT
USING (username IS NOT NULL);