CREATE POLICY "Owners can remove collaborators"
ON public.workspace_collaborators
FOR DELETE
TO authenticated
USING (is_request_owner(auth.uid(), request_id));