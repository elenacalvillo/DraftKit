-- Add column to store requester's profile image URL
ALTER TABLE collab_requests 
ADD COLUMN requester_profile_image_url TEXT;