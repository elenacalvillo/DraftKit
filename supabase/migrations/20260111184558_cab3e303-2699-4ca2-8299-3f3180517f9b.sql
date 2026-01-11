-- Add column to track directory waitlist interest
ALTER TABLE creators ADD COLUMN join_directory_waitlist boolean DEFAULT false;