DROP POLICY IF EXISTS "Project members can read project images" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can update project images" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can delete project images" ON storage.objects;

CREATE POLICY "Project members can read project images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-images'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (
    public.is_project_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Project owners can upload project images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-images'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_project_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Project owners can update project images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-images'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_project_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'project-images'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_project_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Project owners can delete project images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-images'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_project_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);