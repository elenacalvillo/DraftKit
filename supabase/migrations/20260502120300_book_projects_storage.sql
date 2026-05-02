-- =============================================================
-- Book Projects: Storage bucket for chapter images (DRAFT-008)
--
-- Creates a private project-images bucket. Files are organized
-- under /project-images/{project_id}/{filename}. Reads are via
-- signed URLs only (bucket is not public).
-- =============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'project-images',
  false,
  10485760, -- 10 MB max file size (matches app-level validation)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Reads: signed URLs only, but we still allow project members to
-- read directly from the bucket via their own auth context.
-- The first folder in the object name is the project_id.
DROP POLICY IF EXISTS "Project members can read images" ON storage.objects;
CREATE POLICY "Project members can read images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-images'
  AND (
    public.is_project_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR public.is_project_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- Writes: only the project owner / admins (we treat the owning
-- creator as admin). Membership-level admins also allowed.
DROP POLICY IF EXISTS "Project owners can upload images" ON storage.objects;
CREATE POLICY "Project owners can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-images'
  AND public.is_project_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "Project owners can delete images" ON storage.objects;
CREATE POLICY "Project owners can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-images'
  AND public.is_project_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- =============================================================
-- Atomic storage accounting helpers
-- =============================================================
-- 1 GB pooled cap per creator account (DRAFT-008)
CREATE OR REPLACE FUNCTION public.increment_storage_used(_creator_id UUID, _delta_bytes BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total BIGINT;
  cap BIGINT := 1073741824; -- 1 GB
BEGIN
  IF _delta_bytes > 0 THEN
    UPDATE public.creators
    SET storage_used_bytes = storage_used_bytes + _delta_bytes
    WHERE id = _creator_id
      AND (storage_used_bytes + _delta_bytes) <= cap
    RETURNING storage_used_bytes INTO new_total;

    IF new_total IS NULL THEN
      RAISE EXCEPTION
        'Storage cap exceeded: this account has reached its 1GB pooled storage limit.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- Decrement (delete path); never go below zero.
    UPDATE public.creators
    SET storage_used_bytes = GREATEST(storage_used_bytes + _delta_bytes, 0)
    WHERE id = _creator_id
    RETURNING storage_used_bytes INTO new_total;
  END IF;

  RETURN COALESCE(new_total, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_storage_used(uuid, bigint)
  FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_storage_used(uuid, bigint)
  TO authenticated;
