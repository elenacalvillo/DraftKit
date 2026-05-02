-- =============================================================
-- Book Projects: Foundational Schema (DRAFT-002)
--
-- Adds:
--   * projects table
--   * project_members table (with role enum: admin, chapter_writer,
--     peer_reviewer, cross_chapter_reviewer)
--   * Additive columns on collab_requests: project_id,
--     is_project_workspace, chapter_order
--   * storage_used_bytes column on creators
--   * Active project count enforcement (max 3 active projects per creator)
--   * Auto-update trigger on projects.updated_at
--   * RLS enabled on projects + project_members (no policies in this
--     task — those are scoped to DRAFT-003)
--
-- All changes are additive — no existing newsletter flow columns are
-- removed or altered in incompatible ways.
-- =============================================================

-- 1) projects table -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_projects_creator_id_active
  ON public.projects (creator_id)
  WHERE is_archived = false;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Auto-update trigger mirrors the pattern used elsewhere
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) project_members table -----------------------------------------
CREATE TABLE IF NOT EXISTS public.project_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at  TIMESTAMPTZ,
  CONSTRAINT project_members_role_check CHECK (
    role IN ('admin', 'chapter_writer', 'peer_reviewer', 'cross_chapter_reviewer')
  ),
  UNIQUE (project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id
  ON public.project_members (project_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 3) collab_requests additive columns -----------------------------
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_project_workspace BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chapter_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_collab_requests_project_id
  ON public.collab_requests (project_id)
  WHERE project_id IS NOT NULL;

-- Integrity rule: if marked as a project workspace, project_id must
-- be set. Implemented as a CHECK constraint so it's enforced at the
-- table level for both INSERT and UPDATE.
ALTER TABLE public.collab_requests
  DROP CONSTRAINT IF EXISTS collab_requests_project_workspace_requires_project;
ALTER TABLE public.collab_requests
  ADD CONSTRAINT collab_requests_project_workspace_requires_project
  CHECK (
    (is_project_workspace = false) OR (project_id IS NOT NULL)
  );

-- 4) storage_used_bytes on creators -------------------------------
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- 5) Active project count enforcement (safety net at DB layer) ----
-- Prevents creating a 4th active project. The application layer
-- (DRAFT-004) is responsible for the user-facing UX message.
CREATE OR REPLACE FUNCTION public.enforce_active_project_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- Only check when the row will be active after this operation
  IF (TG_OP = 'INSERT' AND NEW.is_archived = false)
     OR (TG_OP = 'UPDATE' AND NEW.is_archived = false AND COALESCE(OLD.is_archived, false) = true) THEN
    SELECT COUNT(*) INTO active_count
    FROM public.projects
    WHERE creator_id = NEW.creator_id
      AND is_archived = false
      AND id <> NEW.id;

    IF active_count >= 3 THEN
      RAISE EXCEPTION
        'Active project limit reached: a creator can have at most 3 active projects. Archive one to create a new project.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_active_project_limit()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_active_project_limit ON public.projects;
CREATE TRIGGER trg_enforce_active_project_limit
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_project_limit();

-- 6) Auto-link project_members on insert (mirror the pattern used
--    by workspace_collaborators).
CREATE OR REPLACE FUNCTION public.link_project_member_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_project_member_on_insert()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_link_project_member_on_insert ON public.project_members;
CREATE TRIGGER trg_link_project_member_on_insert
  BEFORE INSERT ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.link_project_member_on_insert();

-- 7) Extend the existing new-user linker so project_members is
--    also backfilled when an invited email signs up.
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any existing collab requests to this new user
  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE requester_email = NEW.email
    AND requester_user_id IS NULL;

  -- Link any workspace collaborator invitations to this new user
  UPDATE public.workspace_collaborators
  SET user_id = NEW.id
  WHERE email = NEW.email
    AND user_id IS NULL;

  -- Link any project member invitations to this new user
  UPDATE public.project_members
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email)
    AND user_id IS NULL;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_requests_to_new_user()
  FROM anon, authenticated, PUBLIC;
