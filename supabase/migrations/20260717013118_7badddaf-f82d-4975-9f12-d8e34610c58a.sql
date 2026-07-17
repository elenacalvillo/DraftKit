
-- 1. workspace_reads: per-user last-seen timestamp on a workspace
CREATE TABLE IF NOT EXISTS public.workspace_reads (
  user_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_reads TO authenticated;
GRANT ALL ON public.workspace_reads TO service_role;

ALTER TABLE public.workspace_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own reads" ON public.workspace_reads;
CREATE POLICY "Users manage their own reads"
  ON public.workspace_reads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workspace_reads_request_idx ON public.workspace_reads(request_id);

-- 2. mark_workspace_read RPC
CREATE OR REPLACE FUNCTION public.mark_workspace_read(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_workspace_access(uid, _request_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workspace_reads (user_id, request_id, last_read_at)
  VALUES (uid, _request_id, now())
  ON CONFLICT (user_id, request_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_workspace_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_workspace_read(uuid) TO authenticated;

-- 3. list_my_workspaces: add last_message_at, unread_message_count, activity sort
DROP FUNCTION IF EXISTS public.list_my_workspaces();

CREATE OR REPLACE FUNCTION public.list_my_workspaces()
RETURNS TABLE(
  request_id uuid,
  role_in_workspace text,
  status text,
  is_project_workspace boolean,
  is_solo boolean,
  project_id uuid,
  project_title text,
  chapter_title text,
  chapter_order integer,
  message text,
  requested_date date,
  created_at timestamptz,
  approved_at timestamptz,
  content_last_edited_at timestamptz,
  content_last_edited_by text,
  collab_link text,
  host_creator_id uuid,
  host_name text,
  host_username text,
  host_profile_image_url text,
  requester_user_id uuid,
  requester_name text,
  requester_email text,
  requester_profile_image_url text,
  joined_at timestamptz,
  hidden_by_creator boolean,
  hidden_by_requester boolean,
  last_message_at timestamptz,
  unread_message_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid,
           lower(coalesce(auth.jwt() ->> 'email', '')) AS email
  ),
  base AS (
    SELECT cr.id AS request_id, 'host'::text AS role_in_workspace, NULL::timestamptz AS joined_at
    FROM public.collab_requests cr
    JOIN public.creators c ON c.id = cr.creator_id
    WHERE c.user_id = (SELECT uid FROM me) AND cr.hidden_by_creator = false
    UNION
    SELECT cr.id, 'requester', NULL::timestamptz
    FROM public.collab_requests cr
    WHERE cr.requester_user_id = (SELECT uid FROM me) AND cr.hidden_by_requester = false
    UNION
    SELECT wc.request_id, 'collaborator', wc.joined_at
    FROM public.workspace_collaborators wc
    WHERE wc.user_id = (SELECT uid FROM me)
    UNION
    SELECT cr.id, 'project_owner', NULL::timestamptz
    FROM public.collab_requests cr
    JOIN public.projects p ON p.id = cr.project_id
    JOIN public.creators c ON c.id = p.creator_id
    WHERE cr.is_project_workspace = true
      AND c.user_id = (SELECT uid FROM me)
      AND cr.hidden_by_creator = false
  ),
  ranked AS (
    SELECT request_id, role_in_workspace, joined_at,
           CASE role_in_workspace
             WHEN 'host' THEN 1
             WHEN 'project_owner' THEN 2
             WHEN 'requester' THEN 3
             WHEN 'collaborator' THEN 4
           END AS rank
    FROM base
  ),
  deduped AS (
    SELECT DISTINCT ON (request_id) request_id, role_in_workspace, joined_at
    FROM ranked
    ORDER BY request_id, rank
  )
  SELECT
    cr.id,
    d.role_in_workspace,
    cr.status,
    COALESCE(cr.is_project_workspace, false),
    COALESCE(cr.is_solo, false),
    cr.project_id,
    p.title,
    cr.message,
    cr.chapter_order,
    cr.message,
    cr.requested_date,
    cr.created_at,
    cr.approved_at,
    cr.content_last_edited_at,
    cr.content_last_edited_by,
    cr.collab_link,
    cr.creator_id,
    host.name,
    host.username,
    host.profile_image_url,
    cr.requester_user_id,
    CASE WHEN d.role_in_workspace IN ('host','requester','project_owner') THEN cr.requester_name ELSE NULL END,
    CASE WHEN d.role_in_workspace IN ('host','requester','project_owner') THEN cr.requester_email ELSE NULL END,
    cr.requester_profile_image_url,
    d.joined_at,
    COALESCE(cr.hidden_by_creator, false),
    COALESCE(cr.hidden_by_requester, false),
    msg.last_message_at,
    COALESCE(msg.unread_count, 0)::int
  FROM deduped d
  JOIN public.collab_requests cr ON cr.id = d.request_id
  JOIN public.creators host ON host.id = cr.creator_id
  LEFT JOIN public.projects p ON p.id = cr.project_id
  LEFT JOIN public.workspace_reads wr
    ON wr.request_id = cr.id AND wr.user_id = (SELECT uid FROM me)
  LEFT JOIN LATERAL (
    SELECT
      max(cm.created_at) AS last_message_at,
      count(*) FILTER (
        WHERE cm.created_at > COALESCE(wr.last_read_at, '-infinity'::timestamptz)
          AND lower(coalesce(cm.sender_email, '')) <> (SELECT email FROM me)
      ) AS unread_count
    FROM public.collaboration_messages cm
    WHERE cm.request_id = cr.id
  ) msg ON true
  WHERE (SELECT uid FROM me) IS NOT NULL
    AND (
      COALESCE(cr.is_project_workspace, false) = false
      OR EXISTS (
        SELECT 1 FROM public.workspace_collaborators wc
        WHERE wc.request_id = cr.id
          AND (
            (wc.user_id IS NOT NULL AND wc.user_id <> (SELECT uid FROM me))
            OR (wc.user_id IS NULL AND wc.email IS NOT NULL)
          )
      )
      OR (cr.requester_user_id IS NOT NULL AND cr.requester_user_id <> (SELECT uid FROM me))
    )
  ORDER BY GREATEST(
    cr.content_last_edited_at,
    msg.last_message_at,
    cr.approved_at,
    cr.created_at
  ) DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_my_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO authenticated;

-- 4. move_chapter_to_project
CREATE OR REPLACE FUNCTION public.move_chapter_to_project(
  _chapter_id uuid,
  _target_project_id uuid
)
RETURNS TABLE(id uuid, project_id uuid, chapter_order integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  chapter_row public.collab_requests%ROWTYPE;
  old_project uuid;
  old_order integer;
  new_order integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO chapter_row FROM public.collab_requests WHERE id = _chapter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chapter_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(chapter_row.is_project_workspace, false) OR chapter_row.project_id IS NULL THEN
    RAISE EXCEPTION 'not_a_project_chapter' USING ERRCODE = 'P0001';
  END IF;

  old_project := chapter_row.project_id;
  old_order := chapter_row.chapter_order;

  IF old_project = _target_project_id THEN
    RAISE EXCEPTION 'same_project' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_project_owner(uid, old_project) THEN
    RAISE EXCEPTION 'not_authorized_source' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_project_owner(uid, _target_project_id) THEN
    RAISE EXCEPTION 'not_authorized_target' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(cr.chapter_order), 0) + 1 INTO new_order
  FROM public.collab_requests cr
  WHERE cr.project_id = _target_project_id
    AND cr.is_project_workspace = true;

  UPDATE public.collab_requests
     SET project_id = _target_project_id,
         chapter_order = new_order
   WHERE id = _chapter_id;

  IF old_order IS NOT NULL THEN
    UPDATE public.collab_requests
       SET chapter_order = chapter_order - 1
     WHERE project_id = old_project
       AND is_project_workspace = true
       AND chapter_order > old_order;
  END IF;

  RETURN QUERY
  SELECT _chapter_id, _target_project_id, new_order;
END;
$$;

REVOKE ALL ON FUNCTION public.move_chapter_to_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_chapter_to_project(uuid, uuid) TO authenticated;
