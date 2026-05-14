-- =============================================================
-- Workspace Images: Storage bucket for inline workspace draft
-- images (DRAFT-001 of the inline-images story).
--
-- Creates a PUBLIC workspace-images bucket. Files are organized
-- under /workspace-images/{request_id}/{filename}. The bucket is
-- public so that the Supabase Storage URL written into
-- collab_requests.shared_content can render directly in any
-- client (including unauthenticated public-link viewers) without
-- needing a signed URL roundtrip on every render.
--
-- Writes are gated by RLS: only authenticated users with
-- workspace access to the request_id encoded in the path may
-- upload. This is intentionally available to BOTH free and Pro
-- tiers — images are a basic writing primitive, not a premium
-- feature.
-- =============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-images',
  'workspace-images',
  true,
  10485760, -- 10 MB max file size (matches client-side validation
            -- as a defence-in-depth net; the client compresses to 1 MB).
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Reads: bucket is public so anonymous SELECT is allowed by the
-- storage object policies bundled with Supabase. We do not add an
-- explicit SELECT policy here.

-- Writes: any authenticated user who is a participant of the
-- workspace whose request_id appears as the first folder in the
-- object name. Uses the existing public.has_workspace_access
-- helper so the rule stays in sync with the can_edit_workspace
-- probe and save_workspace_content RPC.
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
