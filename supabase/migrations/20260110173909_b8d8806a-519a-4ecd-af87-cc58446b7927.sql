-- Add newsletter_url column to creators table
ALTER TABLE public.creators 
ADD COLUMN newsletter_url TEXT;

-- Update the public_creator_profiles view to include newsletter_url
DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles AS
SELECT 
  id,
  username,
  name,
  substack_url,
  newsletter_url,
  bio,
  welcome_message,
  created_at
FROM public.creators;