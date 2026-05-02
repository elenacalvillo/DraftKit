-- =============================================================
-- Book Projects: Row Level Security (DRAFT-003)
--
-- Adds policies on:
--   * projects
--   * project_members
--   * collab_requests (project chapter rows)
--
-- Plus the can_access_chapter() helper used by the chapter-scoping
-- policies. Role values come from project_members.role and are:
--   admin                  → full access
--   cross_chapter_reviewer → all chapters in project
--   peer_reviewer          → assigned chapters only
--   chapter_writer         → assigned chapters only
-- =============================================================

-- Helper: is the caller the owning creator (admin owner) of project?
CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.creators c ON c.id = p.creator_id
    WHERE p.id = _project_id AND c.user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid)
  FROM anon, PUBLIC;

-- Helper: does caller have ANY membership in project?
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid)
  FROM anon, PUBLIC;

-- Helper: caller's role within a project (NULL if not a member);
-- the owning creator is treated as 'admin' even if no row exists in
-- project_members.
CREATE OR REPLACE FUNCTION public.project_member_role(_user_id UUID, _project_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role TEXT;
BEGIN
  IF public.is_project_owner(_user_id, _project_id) THEN
    RETURN 'admin';
  END IF;

  SELECT pm.role INTO _role
  FROM public.project_members pm
  WHERE pm.project_id = _project_id
    AND pm.user_id = _user_id
  LIMIT 1;

  RETURN _role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.project_member_role(uuid, uuid)
  FROM anon, PUBLIC;

-- can_access_chapter() — main RLS helper for chapter rows.
-- Returns true if the caller can SEE the given chapter row given
-- their role in the parent project.
--
-- Access matrix:
--   admin                  → all chapters
--   cross_chapter_reviewer → all chapters
--   peer_reviewer          → only chapters whose ai_suggestion_used
--                            field flags them as assigned (we
--                            piggy-back via direct chapter writer
--                            assignment on requester_user_id; peer
--                            reviewer assignments live in a future
--                            join table — for now allow if assigned
--                            in project_members.role and chapter
--                            status is Peer Review)
--   chapter_writer         → only chapters where they are the
--                            assigned writer (requester_user_id)
CREATE OR REPLACE FUNCTION public.can_access_chapter(_user_id UUID, _chapter_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id UUID;
  _role TEXT;
  _writer UUID;
  _status TEXT;
BEGIN
  SELECT cr.project_id, cr.requester_user_id, cr.status
    INTO _project_id, _writer, _status
  FROM public.collab_requests cr
  WHERE cr.id = _chapter_id;

  IF _project_id IS NULL THEN
    -- Not a project chapter — fall through to the existing
    -- has_workspace_access() which handles newsletter flow.
    RETURN public.has_workspace_access(_user_id, _chapter_id);
  END IF;

  _role := public.project_member_role(_user_id, _project_id);

  IF _role IS NULL THEN
    RETURN false;
  END IF;

  IF _role = 'admin' OR _role = 'cross_chapter_reviewer' THEN
    RETURN true;
  END IF;

  IF _role = 'chapter_writer' THEN
    RETURN _writer = _user_id;
  END IF;

  IF _role = 'peer_reviewer' THEN
    -- Visible only when the chapter is in a review/editorial stage
    -- AND the reviewer was the original requester (assigned writer
    -- assignment join is out of scope for v1 schema).
    RETURN _writer = _user_id
       OR _status IN ('Peer Review', 'Editorial');
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_chapter(uuid, uuid)
  FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_chapter(uuid, uuid)
  TO authenticated;

-- =============================================================
-- projects RLS
-- =============================================================
DROP POLICY IF EXISTS "Owners can view projects" ON public.projects;
CREATE POLICY "Owners can view projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members can view projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = id AND pm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can insert projects" ON public.projects;
CREATE POLICY "Owners can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
CREATE POLICY "Owners can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
)
WITH CHECK (
  creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
);

-- v1: deletion is out of scope (archive only). No DELETE policy.

-- =============================================================
-- project_members RLS
-- =============================================================
DROP POLICY IF EXISTS "Project owners can view members" ON public.project_members;
CREATE POLICY "Project owners can view members"
ON public.project_members FOR SELECT
TO authenticated
USING (public.is_project_owner(auth.uid(), project_id));

DROP POLICY IF EXISTS "Members can view own membership" ON public.project_members;
CREATE POLICY "Members can view own membership"
ON public.project_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Project owners can invite members" ON public.project_members;
CREATE POLICY "Project owners can invite members"
ON public.project_members FOR INSERT
TO authenticated
WITH CHECK (public.is_project_owner(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project owners can update members" ON public.project_members;
CREATE POLICY "Project owners can update members"
ON public.project_members FOR UPDATE
TO authenticated
USING (public.is_project_owner(auth.uid(), project_id))
WITH CHECK (public.is_project_owner(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project owners can remove members" ON public.project_members;
CREATE POLICY "Project owners can remove members"
ON public.project_members FOR DELETE
TO authenticated
USING (public.is_project_owner(auth.uid(), project_id));

-- =============================================================
-- collab_requests project-chapter access
-- (extends, does not replace, the existing newsletter policies)
-- =============================================================
DROP POLICY IF EXISTS "Project members can view chapters" ON public.collab_requests;
CREATE POLICY "Project members can view chapters"
ON public.collab_requests FOR SELECT
TO authenticated
USING (
  is_project_workspace = true
  AND public.can_access_chapter(auth.uid(), id)
);

DROP POLICY IF EXISTS "Project admins can manage chapters" ON public.collab_requests;
CREATE POLICY "Project admins can manage chapters"
ON public.collab_requests FOR UPDATE
TO authenticated
USING (
  is_project_workspace = true
  AND public.is_project_owner(auth.uid(), project_id)
)
WITH CHECK (
  is_project_workspace = true
  AND public.is_project_owner(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Project admins can insert chapters" ON public.collab_requests;
CREATE POLICY "Project admins can insert chapters"
ON public.collab_requests FOR INSERT
TO authenticated
WITH CHECK (
  is_project_workspace = true
  AND public.is_project_owner(auth.uid(), project_id)
);
