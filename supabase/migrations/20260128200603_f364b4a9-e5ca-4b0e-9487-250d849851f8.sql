-- Add collab_mode column to creators table
-- This determines whether the creator prefers async-first or discovery-first collaborations
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS collab_mode TEXT DEFAULT 'async';

-- Add comment for documentation
COMMENT ON COLUMN public.creators.collab_mode IS 'Collaboration mode: async (publication-focused) or discovery (call-first)';

-- Update the public_creator_profiles view to include collab_mode
DROP VIEW IF EXISTS public.public_creator_profiles;
CREATE VIEW public.public_creator_profiles AS
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