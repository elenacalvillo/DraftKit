-- =============================================================
-- Book Projects: 'project' tier + broadcasts log (DRAFT-004 + 009)
--
-- Adds:
--   * has_project_access() function — superset of pro tier check
--   * project_broadcasts table — admin-to-team announcement log
-- =============================================================

-- has_project_access(user) — true if the user is on the 'project'
-- subscription tier. The 'project' tier is a SUPERSET of 'pro';
-- consumers that previously checked is_pro_user() should keep using
-- it (we extend that function below) and consumers that need the
-- additional book-project capability should call this one.
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creators
    WHERE user_id = _user_id
      AND subscription_tier = 'project'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid)
  FROM anon, authenticated, PUBLIC;

-- Update is_pro_user() so 'project' tier counts as pro (superset).
CREATE OR REPLACE FUNCTION public.is_pro_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = 'pro'
  )
  OR EXISTS (
    SELECT 1 FROM creators
    WHERE user_id = _user_id
      AND subscription_tier IN ('pro', 'project')
      AND (trial_ends_at IS NULL OR trial_ends_at > NOW())
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_pro_user(uuid)
  FROM anon, authenticated, PUBLIC;

-- =============================================================
-- project_broadcasts — admin-to-team broadcast history
-- =============================================================
CREATE TABLE IF NOT EXISTS public.project_broadcasts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message     TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_broadcasts_message_not_blank CHECK (length(trim(message)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_project_broadcasts_project_id
  ON public.project_broadcasts (project_id, created_at DESC);

ALTER TABLE public.project_broadcasts ENABLE ROW LEVEL SECURITY;

-- Project members (and the project owner) can view broadcasts.
DROP POLICY IF EXISTS "Project members can view broadcasts" ON public.project_broadcasts;
CREATE POLICY "Project members can view broadcasts"
ON public.project_broadcasts FOR SELECT
TO authenticated
USING (
  public.is_project_owner(auth.uid(), project_id)
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_broadcasts.project_id
      AND pm.user_id = auth.uid()
  )
);

-- Only the project owner can insert broadcasts (server-side
-- broadcast Edge Function uses service role, but we still grant
-- the owner direct insert capability for fall-back cases).
DROP POLICY IF EXISTS "Project owners can send broadcasts" ON public.project_broadcasts;
CREATE POLICY "Project owners can send broadcasts"
ON public.project_broadcasts FOR INSERT
TO authenticated
WITH CHECK (
  public.is_project_owner(auth.uid(), project_id)
  AND sender_id = auth.uid()
);
