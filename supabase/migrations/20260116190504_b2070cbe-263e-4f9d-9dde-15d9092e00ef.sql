-- Add selected_collab_type column to track guest's chosen collaboration type
ALTER TABLE public.collab_requests 
ADD COLUMN selected_collab_type TEXT DEFAULT NULL;