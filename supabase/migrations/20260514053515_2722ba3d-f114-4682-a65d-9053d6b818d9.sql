-- Workspace Images: storage bucket + RLS for inline workspace draft images.
-- Idempotent re-application of supabase/migrations/20260514120000_workspace_images_storage.sql
-- which exists in the repo but was not applied to the live database.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-images',
  'workspace-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Workspace participants can upload workspace images" ON storage.objects;
CREATE POLICY "Workspace participants can upload workspace images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workspace-images'
  AND public.has_workspace_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

DROP POLICY IF EXISTS "Workspace participants can update workspace images" ON storage.objects;
CREATE POLICY "Workspace participants can update workspace images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'workspace-images'
  AND public.has_workspace_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
)
WITH CHECK (
  bucket_id = 'workspace-images'
  AND public.has_workspace_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

DROP POLICY IF EXISTS "Workspace participants can delete workspace images" ON storage.objects;
CREATE POLICY "Workspace participants can delete workspace images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workspace-images'
  AND public.has_workspace_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);