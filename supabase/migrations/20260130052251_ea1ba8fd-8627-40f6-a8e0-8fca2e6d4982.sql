-- Add profile_theme column to creators table
ALTER TABLE creators ADD COLUMN profile_theme JSONB DEFAULT '{"preset": "default"}'::jsonb;

-- Recreate public_creator_profiles view to expose the theme
CREATE OR REPLACE VIEW public_creator_profiles AS
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