CREATE POLICY "Requesters can cancel approved requests"
ON public.collab_requests
FOR UPDATE
TO public
USING (requester_user_id = auth.uid() AND status = 'approved')
WITH CHECK (status = 'cancelled');