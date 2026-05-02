
-- =========================================================
-- Project tier schema
-- =========================================================

-- 1. projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_creator ON public.projects(creator_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. project_members
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid,
  role text NOT NULL CHECK (role IN ('admin','chapter_writer','peer_reviewer','cross_chapter_reviewer')),
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz
);
CREATE UNIQUE INDEX uq_project_members_project_email
  ON public.project_members(project_id, lower(email));
CREATE INDEX idx_project_members_user ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 3. project_broadcasts
CREATE TABLE public.project_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_name text,
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_broadcasts_project ON public.project_broadcasts(project_id);

ALTER TABLE public.project_broadcasts ENABLE ROW LEVEL SECURITY;

-- 4. collab_requests new columns (nullable / safe defaults)
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_project_workspace boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chapter_order integer;

CREATE INDEX IF NOT EXISTS idx_collab_requests_project ON public.collab_requests(project_id);

-- =========================================================
-- Helper RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.creators c ON c.id = p.creator_id
    WHERE p.id = _project_id AND c.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- =========================================================
-- Auto-link project_members to existing auth users
-- =========================================================
CREATE OR REPLACE FUNCTION public.link_project_member_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.email)
    LIMIT 1;
  END IF;
  IF NEW.user_id IS NOT NULL AND NEW.joined_at IS NULL THEN
    NEW.joined_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_members_link_before_insert
  BEFORE INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.link_project_member_on_insert();

-- Extend the existing on-signup linker to also catch project_members
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE requester_user_id IS NULL
    AND public.normalize_email(requester_email) = public.normalize_email(NEW.email);

  UPDATE public.workspace_collaborators
  SET user_id = NEW.id,
      joined_at = COALESCE(joined_at, now())
  WHERE user_id IS NULL
    AND public.normalize_email(email) = public.normalize_email(NEW.email);

  UPDATE public.project_members
  SET user_id = NEW.id,
      joined_at = COALESCE(joined_at, now())
  WHERE user_id IS NULL
    AND public.normalize_email(email) = public.normalize_email(NEW.email);

  RETURN NEW;
END;
$$;

-- =========================================================
-- RLS: projects
-- =========================================================
CREATE POLICY "Owners manage own projects"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

CREATE POLICY "Members can view their projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), id));

-- =========================================================
-- RLS: project_members
-- =========================================================
CREATE POLICY "Owners manage project members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.is_project_owner(auth.uid(), project_id))
  WITH CHECK (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Member can view own membership"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members can view fellow members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

-- =========================================================
-- RLS: project_broadcasts
-- =========================================================
CREATE POLICY "Owners can insert broadcasts"
  ON public.project_broadcasts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Owners can view broadcasts"
  ON public.project_broadcasts
  FOR SELECT
  TO authenticated
  USING (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Members can view broadcasts"
  ON public.project_broadcasts
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
