-- 1. Add chapter_stage column for project chapter editorial workflow
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS chapter_stage text;

-- 2. Validate allowed chapter_stage values (only required when set)
ALTER TABLE public.collab_requests
  DROP CONSTRAINT IF EXISTS collab_requests_chapter_stage_check;
ALTER TABLE public.collab_requests
  ADD CONSTRAINT collab_requests_chapter_stage_check
  CHECK (
    chapter_stage IS NULL
    OR chapter_stage = ANY (ARRAY['draft','peer_review','editorial','final'])
  );

-- 3. Drop the broken chapter insert policy (it allowed status values
--    that the global collab_requests_status_check constraint rejects,
--    so every chapter insert failed with a 23514 error).
DROP POLICY IF EXISTS "Project owners can create chapter workspaces" ON public.collab_requests;
