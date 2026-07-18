
-- 1. chapter_revisions table
CREATE TABLE IF NOT EXISTS public.chapter_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  shared_content text,
  editor_name text,
  editor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chapter_revisions_request_created_idx
  ON public.chapter_revisions (request_id, created_at DESC);

GRANT SELECT ON public.chapter_revisions TO authenticated;
GRANT ALL ON public.chapter_revisions TO service_role;

ALTER TABLE public.chapter_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace participants can view revisions"
  ON public.chapter_revisions FOR SELECT
  TO authenticated
  USING (public.has_workspace_access(auth.uid(), request_id));

-- 2. is_comment_only_reviewer helper
CREATE OR REPLACE FUNCTION public.is_comment_only_reviewer(_user_id uuid, _request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collab_requests cr
    JOIN public.project_members pm ON pm.project_id = cr.project_id
    WHERE cr.id = _request_id
      AND cr.is_project_workspace = true
      AND pm.user_id = _user_id
      AND pm.role IN ('peer_reviewer', 'cross_chapter_reviewer')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_comment_only_reviewer(uuid, uuid) TO authenticated;

-- 3. Normalizer used to compare drafts while ignoring highlight/comment marks.
CREATE OR REPLACE FUNCTION public._normalize_for_comment_diff(_html text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(_html, ''), '</?span[^>]*>', '', 'gi'),
      '\s+', ' ', 'g'
    ),
    '^\s+|\s+$', '', 'g'
  );
$$;

-- 4. Updated save_workspace_content: snapshot + reviewer guard.
CREATE OR REPLACE FUNCTION public.save_workspace_content(
  _request_id uuid,
  _content text,
  _editor_name text,
  _editing_sessions jsonb
)
RETURNS TABLE(
  id uuid,
  shared_content text,
  content_last_edited_by text,
  content_last_edited_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  req record;
  last_snap timestamptz;
  reviewer boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT cr.id, cr.status, cr.requester_email, cr.requester_user_id,
         cr.shared_content, cr.content_last_edited_by
    INTO req
  FROM public.collab_requests cr
  WHERE cr.id = _request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF req.status <> 'approved' THEN
    RAISE EXCEPTION 'status_not_approved:%', req.status USING ERRCODE = 'P0001';
  END IF;

  SELECT u.email INTO user_email FROM auth.users u WHERE u.id = uid;

  IF user_email IS NOT NULL THEN
    IF req.requester_user_id IS NULL
       AND req.requester_email IS NOT NULL
       AND public.normalize_email(req.requester_email) = public.normalize_email(user_email)
    THEN
      UPDATE public.collab_requests
      SET requester_user_id = uid
      WHERE id = _request_id;
    END IF;

    UPDATE public.workspace_collaborators
    SET user_id = uid,
        joined_at = COALESCE(joined_at, now())
    WHERE request_id = _request_id
      AND user_id IS NULL
      AND email IS NOT NULL
      AND public.normalize_email(email) = public.normalize_email(user_email);
  END IF;

  IF NOT public.has_workspace_access(uid, _request_id) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = '42501';
  END IF;

  -- Comment-only guard: reviewers may only modify highlight/comment marks.
  reviewer := public.is_comment_only_reviewer(uid, _request_id);
  IF reviewer THEN
    IF public._normalize_for_comment_diff(req.shared_content)
       IS DISTINCT FROM public._normalize_for_comment_diff(_content) THEN
      RAISE EXCEPTION 'reviewers_can_only_add_comments' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Snapshot the pre-update state at most once every 2 minutes.
  SELECT max(created_at) INTO last_snap
  FROM public.chapter_revisions WHERE request_id = _request_id;

  IF (last_snap IS NULL OR last_snap < now() - interval '2 minutes')
     AND req.shared_content IS DISTINCT FROM _content
     AND req.shared_content IS NOT NULL
  THEN
    INSERT INTO public.chapter_revisions (request_id, shared_content, editor_name, editor_user_id)
    VALUES (_request_id, req.shared_content, req.content_last_edited_by, uid);

    DELETE FROM public.chapter_revisions
    WHERE request_id = _request_id
      AND id NOT IN (
        SELECT id FROM public.chapter_revisions
        WHERE request_id = _request_id
        ORDER BY created_at DESC
        LIMIT 30
      );
  END IF;

  RETURN QUERY
  UPDATE public.collab_requests cr
  SET shared_content = NULLIF(_content, ''),
      content_last_edited_by = _editor_name,
      content_last_edited_at = now(),
      editing_sessions = COALESCE(_editing_sessions, cr.editing_sessions)
  WHERE cr.id = _request_id
  RETURNING cr.id, cr.shared_content, cr.content_last_edited_by, cr.content_last_edited_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workspace_content(uuid, text, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_workspace_content(uuid, text, text, jsonb) FROM anon, PUBLIC;

-- 5. Restore function: only project owner / admin members can roll back.
CREATE OR REPLACE FUNCTION public.restore_chapter_revision(_revision_id uuid)
RETURNS TABLE(
  id uuid,
  shared_content text,
  content_last_edited_by text,
  content_last_edited_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rev record;
  chapter record;
  is_owner boolean;
  is_admin_member boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO rev FROM public.chapter_revisions WHERE id = _revision_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'revision_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT cr.id, cr.project_id, cr.creator_id, cr.status, cr.shared_content, cr.content_last_edited_by
    INTO chapter
  FROM public.collab_requests cr
  WHERE cr.id = rev.request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'chapter_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.creators c WHERE c.id = chapter.creator_id AND c.user_id = uid
  ) INTO is_owner;

  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = chapter.project_id AND pm.user_id = uid AND pm.role = 'admin'
  ) INTO is_admin_member;

  IF NOT (is_owner OR is_admin_member) THEN
    RAISE EXCEPTION 'not_authorized_to_restore' USING ERRCODE = '42501';
  END IF;

  -- Snapshot the current state before overwriting so restore is itself undoable.
  IF chapter.shared_content IS NOT NULL
     AND chapter.shared_content IS DISTINCT FROM rev.shared_content THEN
    INSERT INTO public.chapter_revisions (request_id, shared_content, editor_name, editor_user_id)
    VALUES (rev.request_id, chapter.shared_content, chapter.content_last_edited_by, uid);

    DELETE FROM public.chapter_revisions
    WHERE request_id = rev.request_id
      AND id NOT IN (
        SELECT id FROM public.chapter_revisions
        WHERE request_id = rev.request_id
        ORDER BY created_at DESC
        LIMIT 30
      );
  END IF;

  RETURN QUERY
  UPDATE public.collab_requests cr
  SET shared_content = rev.shared_content,
      content_last_edited_by = COALESCE(rev.editor_name, cr.content_last_edited_by) || ' (restored)',
      content_last_edited_at = now()
  WHERE cr.id = rev.request_id
  RETURNING cr.id, cr.shared_content, cr.content_last_edited_by, cr.content_last_edited_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_chapter_revision(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_chapter_revision(uuid) FROM anon, PUBLIC;
