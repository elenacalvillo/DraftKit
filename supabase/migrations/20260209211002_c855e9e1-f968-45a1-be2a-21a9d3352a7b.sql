
-- Add shared workspace columns to collab_requests
ALTER TABLE collab_requests
  ADD COLUMN shared_content text,
  ADD COLUMN content_last_edited_by text,
  ADD COLUMN content_last_edited_at timestamptz;

-- Allow requesters to update workspace fields on approved requests
CREATE POLICY "Requesters can edit shared workspace"
  ON collab_requests FOR UPDATE
  USING (requester_user_id = auth.uid() AND status = 'approved')
  WITH CHECK (status = 'approved');
