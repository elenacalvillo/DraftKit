-- Allow project owners to create chapter workspaces (collab_requests rows
-- with is_project_workspace=true). Existing INSERT policies only cover
-- pending requests and approved solo workspaces, so chapter inserts (status
-- 'Draft', etc.) were silently rejected by RLS.
CREATE POLICY "Project owners can create chapter workspaces"
ON public.collab_requests
FOR INSERT
TO authenticated
WITH CHECK (
  is_project_workspace = true
  AND project_id IS NOT NULL
  AND status = ANY (ARRAY['Draft','In Review','Approved','Scheduled','Published'])
  AND creator_id IN (
    SELECT c.id FROM public.creators c WHERE c.user_id = auth.uid()
  )
  AND hidden_by_creator = false
  AND hidden_by_requester = false
  AND requester_name IS NOT NULL
  AND char_length(btrim(requester_name)) BETWEEN 1 AND 100
  AND requester_email IS NOT NULL
  AND char_length(btrim(requester_email)) BETWEEN 3 AND 255
  AND btrim(requester_email) ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  AND ai_draft IS NULL
  AND approved_at IS NULL
  AND reminder_sent_at IS NULL
  AND creator_notes IS NULL
);

-- Performance: keep chapter list fetch (project_id + chapter_order ordering) snappy.
CREATE INDEX IF NOT EXISTS idx_collab_requests_project_id
  ON public.collab_requests (project_id)
  WHERE project_id IS NOT NULL;