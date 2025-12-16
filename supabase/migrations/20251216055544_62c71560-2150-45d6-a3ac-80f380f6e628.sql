-- Add a partial unique constraint to prevent race conditions in booking
-- This ensures only one non-declined request can exist per creator per date
CREATE UNIQUE INDEX idx_unique_active_booking 
ON public.collab_requests (creator_id, requested_date) 
WHERE status != 'declined';