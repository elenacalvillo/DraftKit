
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
  can_access boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT cr.id, cr.status, cr.requester_email, cr.requester_user_id,
         cr.shared_content, cr.content_last_edited_by, cr.project_id,
         cr.is_project_workspace
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

  can_access := public.has_workspace_access(uid, _request_id);
  IF NOT can_access
     AND COALESCE(req.is_project_workspace, false)
     AND req.project_id IS NOT NULL
  THEN
    can_access := public.is_project_member(uid, req.project_id)
                  OR public.is_project_owner(uid, req.project_id);
  END IF;
  IF NOT can_access THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = '42501';
  END IF;

  reviewer := public.is_comment_only_reviewer(uid, _request_id);
  IF reviewer THEN
    IF public._normalize_for_comment_diff(req.shared_content)
       IS DISTINCT FROM public._normalize_for_comment_diff(_content) THEN
      RAISE EXCEPTION 'reviewers_can_only_add_comments' USING ERRCODE = '42501';
    END IF;
  END IF;

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

DROP POLICY IF EXISTS "Workspace participants can view revisions" ON public.chapter_revisions;
CREATE POLICY "Workspace or project participants can view revisions"
  ON public.chapter_revisions FOR SELECT
  TO authenticated
  USING (
    public.has_workspace_access(auth.uid(), request_id)
    OR EXISTS (
      SELECT 1 FROM public.collab_requests cr
      WHERE cr.id = chapter_revisions.request_id
        AND cr.project_id IS NOT NULL
        AND (
          public.is_project_member(auth.uid(), cr.project_id)
          OR public.is_project_owner(auth.uid(), cr.project_id)
        )
    )
  );
