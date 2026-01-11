-- Drop the existing constraint
ALTER TABLE collab_requests DROP CONSTRAINT collab_requests_status_check;

-- Add new constraint with 'cancelled' status
ALTER TABLE collab_requests 
ADD CONSTRAINT collab_requests_status_check 
CHECK (status = ANY (ARRAY['pending', 'approved', 'declined', 'cancelled']));