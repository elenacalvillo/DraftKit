-- Invited workspace collaborators can read the collab_request they were added to.
CREATE POLICY "Collaborators can view shared workspaces"
ON public.collab_requests
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT wc.request_id
    FROM public.workspace_collaborators wc
    WHERE wc.user_id = auth.uid()
  )
);

-- Project members can read every chapter workspace inside their project.
CREATE POLICY "Project members can view project workspaces"
ON public.collab_requests
FOR SELECT
TO authenticated
USING (
  is_project_workspace = true
  AND project_id IS NOT NULL
  AND project_id IN (
    SELECT pm.project_id
    FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
  )
);
