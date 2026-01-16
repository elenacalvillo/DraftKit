-- Drop and recreate the view with new columns
DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles AS
SELECT 
  id,
  username,
  name,
  bio,
  newsletter_url,
  substack_url,
  welcome_message,
  profile_image_url,
  created_at,
  collab_style,
  collab_guidelines
FROM public.creators;

-- Add RLS policy for requesters to cancel their own pending requests
CREATE POLICY "Requesters can cancel own pending requests" 
ON public.collab_requests 
FOR UPDATE
USING (requester_user_id = auth.uid() AND status = 'pending')
WITH CHECK (status IN ('cancelled', 'pending'));