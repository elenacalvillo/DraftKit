
CREATE OR REPLACE FUNCTION public.save_workspace_content(_request_id uuid, _content text, _editor_name text, _editing_sessions jsonb)
 RETURNS TABLE(id uuid, shared_content text, content_last_edited_by text, content_last_edited_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
      UPDATE public.collab_requests cr
      SET requester_user_id = uid
      WHERE cr.id = _request_id;
    END IF;

    UPDATE public.workspace_collaborators wc
    SET user_id = uid,
        joined_at = COALESCE(wc.joined_at, now())
    WHERE wc.request_id = _request_id
      AND wc.user_id IS NULL
      AND wc.email IS NOT NULL
      AND public.normalize_email(wc.email) = public.normalize_email(user_email);
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

  SELECT max(rev.created_at) INTO last_snap
  FROM public.chapter_revisions rev
  WHERE rev.request_id = _request_id;

  IF (last_snap IS NULL OR last_snap < now() - interval '2 minutes')
     AND req.shared_content IS DISTINCT FROM _content
     AND req.shared_content IS NOT NULL
  THEN
    INSERT INTO public.chapter_revisions (request_id, shared_content, editor_name, editor_user_id)
    VALUES (_request_id, req.shared_content, req.content_last_edited_by, uid);

    DELETE FROM public.chapter_revisions rev
    WHERE rev.request_id = _request_id
      AND rev.id NOT IN (
        SELECT rev2.id FROM public.chapter_revisions rev2
        WHERE rev2.request_id = _request_id
        ORDER BY rev2.created_at DESC
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
$function$;

CREATE OR REPLACE FUNCTION public.restore_chapter_revision(_revision_id uuid)
 RETURNS TABLE(id uuid, shared_content text, content_last_edited_by text, content_last_edited_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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

  SELECT r.id, r.request_id, r.shared_content, r.editor_name, r.editor_user_id, r.created_at
    INTO rev
  FROM public.chapter_revisions r WHERE r.id = _revision_id;
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

  IF chapter.shared_content IS NOT NULL
     AND chapter.shared_content IS DISTINCT FROM rev.shared_content THEN
    INSERT INTO public.chapter_revisions (request_id, shared_content, editor_name, editor_user_id)
    VALUES (rev.request_id, chapter.shared_content, chapter.content_last_edited_by, uid);

    DELETE FROM public.chapter_revisions r
    WHERE r.request_id = rev.request_id
      AND r.id NOT IN (
        SELECT r2.id FROM public.chapter_revisions r2
        WHERE r2.request_id = rev.request_id
        ORDER BY r2.created_at DESC
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
$function$;
