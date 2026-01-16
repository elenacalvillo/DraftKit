-- Add columns to track soft-delete per user type
ALTER TABLE collab_requests
ADD COLUMN hidden_by_creator BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN hidden_by_requester BOOLEAN NOT NULL DEFAULT false;

-- Allow requesters to hide their cancelled requests
CREATE POLICY "Requesters can hide cancelled requests"
ON collab_requests
FOR UPDATE
USING (
  requester_user_id = auth.uid() 
  AND status = 'cancelled'
)
WITH CHECK (
  hidden_by_requester = true
);