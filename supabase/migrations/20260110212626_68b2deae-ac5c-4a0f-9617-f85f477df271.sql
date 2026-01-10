-- Add profile_image_url column to creators table
ALTER TABLE creators 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Update the public_creator_profiles view to include the new column
DROP VIEW IF EXISTS public_creator_profiles;
CREATE VIEW public_creator_profiles AS
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