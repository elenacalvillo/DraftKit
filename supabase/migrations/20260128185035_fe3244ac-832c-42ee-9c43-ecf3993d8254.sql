-- Add column to track which AI suggestion was used (for owner visibility)
ALTER TABLE public.collab_requests
ADD COLUMN ai_suggestion_used jsonb DEFAULT NULL;