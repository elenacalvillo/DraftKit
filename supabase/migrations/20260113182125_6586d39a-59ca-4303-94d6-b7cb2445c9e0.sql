-- Drop the existing constraint that only excludes 'declined'
DROP INDEX IF EXISTS public.idx_unique_active_booking;

-- Create updated constraint excluding both declined AND cancelled
CREATE UNIQUE INDEX idx_unique_active_booking 
ON public.collab_requests (creator_id, requested_date) 
WHERE status NOT IN ('declined', 'cancelled');