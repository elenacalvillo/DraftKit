
-- ============================================
-- 1. workspace_collaborators table
-- ============================================
CREATE TABLE public.workspace_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,
  UNIQUE(request_id, email)
);

ALTER TABLE public.workspace_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is the creator (owner) of a request
CREATE OR REPLACE FUNCTION public.is_request_owner(_user_id UUID, _request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collab_requests cr
    JOIN creators c ON cr.creator_id = c.id
    WHERE cr.id = _request_id AND c.user_id = _user_id
  )
$$;

-- Helper: check if user has workspace access (creator, requester, or collaborator)
CREATE OR REPLACE FUNCTION public.has_workspace_access(_user_id UUID, _request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Creator
    SELECT 1 FROM collab_requests cr
    JOIN creators c ON cr.creator_id = c.id
    WHERE cr.id = _request_id AND c.user_id = _user_id
  ) OR EXISTS (
    -- Requester
    SELECT 1 FROM collab_requests cr
    WHERE cr.id = _request_id AND cr.requester_user_id = _user_id
  ) OR EXISTS (
    -- Collaborator
    SELECT 1 FROM workspace_collaborators wc
    WHERE wc.request_id = _request_id AND wc.user_id = _user_id
  )
$$;

-- Owners can view collaborators for their requests
CREATE POLICY "Owners can view collaborators"
ON public.workspace_collaborators FOR SELECT
TO authenticated
USING (public.is_request_owner(auth.uid(), request_id));

-- Collaborators can view their own rows
CREATE POLICY "Collaborators can view own invitations"
ON public.workspace_collaborators FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only owners can invite
CREATE POLICY "Owners can invite collaborators"
ON public.workspace_collaborators FOR INSERT
TO authenticated
WITH CHECK (
  public.is_request_owner(auth.uid(), request_id)
  AND invited_by = auth.uid()
);

-- ============================================
-- 2. workspace_presence table
-- ============================================
CREATE TABLE public.workspace_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_unsaved BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(request_id, user_id)
);

ALTER TABLE public.workspace_presence ENABLE ROW LEVEL SECURITY;

-- Anyone with workspace access can view presence
CREATE POLICY "Workspace members can view presence"
ON public.workspace_presence FOR SELECT
TO authenticated
USING (public.has_workspace_access(auth.uid(), request_id));

-- Users can upsert their own presence
CREATE POLICY "Users can insert own presence"
ON public.workspace_presence FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_workspace_access(auth.uid(), request_id)
);

CREATE POLICY "Users can update own presence"
ON public.workspace_presence FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3. Extend collab_requests SELECT for collaborators
-- ============================================
CREATE POLICY "Collaborators can view invited requests"
ON public.collab_requests FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT wc.request_id FROM workspace_collaborators wc
    WHERE wc.user_id = auth.uid()
  )
);

-- Collaborators can edit shared workspace on approved requests
CREATE POLICY "Collaborators can edit shared workspace"
ON public.collab_requests FOR UPDATE
TO authenticated
USING (
  id IN (SELECT wc.request_id FROM workspace_collaborators wc WHERE wc.user_id = auth.uid())
  AND status = 'approved'
)
WITH CHECK (status = 'approved');

-- ============================================
-- 4. Extend collaboration_messages for collaborators
-- ============================================
CREATE POLICY "Collaborators can view workspace messages"
ON public.collaboration_messages FOR SELECT
TO authenticated
USING (
  request_id IN (
    SELECT wc.request_id FROM workspace_collaborators wc
    WHERE wc.user_id = auth.uid()
  )
);

CREATE POLICY "Collaborators can send workspace messages"
ON public.collaboration_messages FOR INSERT
TO authenticated
WITH CHECK (
  request_id IN (
    SELECT wc.request_id FROM workspace_collaborators wc
    WHERE wc.user_id = auth.uid()
  )
);

-- ============================================
-- 5. Extend link_requests_to_new_user to also link collaborators
-- ============================================
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

  RETURN NEW;
END;
$$;
