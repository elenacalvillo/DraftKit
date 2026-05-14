DROP POLICY IF EXISTS "Workspace participants can upload workspace images" ON storage.objects;
DROP POLICY IF EXISTS "Workspace participants can update workspace images" ON storage.objects;
DROP POLICY IF EXISTS "Workspace participants can delete workspace images" ON storage.objects;

CREATE POLICY "Workspace participants can upload workspace images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workspace-images'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (
    SELECT 1 FROM public.collab_requests cr
    LEFT JOIN public.creators c ON c.id = cr.creator_id
    WHERE cr.id = ((storage.foldername(name))[1])::uuid
      AND (
        c.user_id = (SELECT auth.uid())
        OR cr.requester_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id
            AND wc.user_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY "Workspace participants can update workspace images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'workspace-images'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (
    SELECT 1 FROM public.collab_requests cr
    LEFT JOIN public.creators c ON c.id = cr.creator_id
    WHERE cr.id = ((storage.foldername(name))[1])::uuid
      AND (
        c.user_id = (SELECT auth.uid())
        OR cr.requester_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id AND wc.user_id = (SELECT auth.uid())
        )
      )
  )
)
WITH CHECK (
  bucket_id = 'workspace-images'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (
    SELECT 1 FROM public.collab_requests cr
    LEFT JOIN public.creators c ON c.id = cr.creator_id
    WHERE cr.id = ((storage.foldername(name))[1])::uuid
      AND (
        c.user_id = (SELECT auth.uid())
        OR cr.requester_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id AND wc.user_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY "Workspace participants can delete workspace images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'workspace-images'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (
    SELECT 1 FROM public.collab_requests cr
    LEFT JOIN public.creators c ON c.id = cr.creator_id
    WHERE cr.id = ((storage.foldername(name))[1])::uuid
      AND (
        c.user_id = (SELECT auth.uid())
        OR cr.requester_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id AND wc.user_id = (SELECT auth.uid())
        )
      )
  )
);