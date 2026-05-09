
-- 1. Backfill: link any unmatched requesters / collaborators to their auth.users by normalized email.
UPDATE public.collab_requests cr
SET requester_user_id = u.id
FROM auth.users u
WHERE cr.requester_user_id IS NULL
  AND cr.requester_email IS NOT NULL
  AND public.normalize_email(u.email) = public.normalize_email(cr.requester_email);

UPDATE public.workspace_collaborators wc
SET user_id = u.id,
    joined_at = COALESCE(wc.joined_at, now())
FROM auth.users u
WHERE wc.user_id IS NULL
  AND wc.email IS NOT NULL
  AND public.normalize_email(u.email) = public.normalize_email(wc.email);

-- 2. can_edit_workspace: pre-flight permission probe.
CREATE OR REPLACE FUNCTION public.can_edit_workspace(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  req record;
  has_access boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('can_edit', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id, status INTO req FROM public.collab_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_edit', false, 'reason', 'request_not_found');
  END IF;

  SELECT public.has_workspace_access(uid, _request_id) INTO has_access;
  IF NOT has_access THEN
    RETURN jsonb_build_object('can_edit', false, 'reason', 'not_a_participant');
  END IF;

  IF req.status <> 'approved' THEN
    RETURN jsonb_build_object('can_edit', false, 'reason', 'status_not_approved', 'status', req.status);
  END IF;

  RETURN jsonb_build_object('can_edit', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_workspace(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit_workspace(uuid) FROM anon, PUBLIC;

-- 3. save_workspace_content: server-authoritative save.
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
  linked boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT cr.id, cr.status, cr.requester_email, cr.requester_user_id
    INTO req
  FROM public.collab_requests cr
  WHERE cr.id = _request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF req.status <> 'approved' THEN
    RAISE EXCEPTION 'status_not_approved:%', req.status USING ERRCODE = 'P0001';
  END IF;

  -- Best-effort late linkage: if user's email matches the requester or a
  -- collaborator row, stamp the user_id so future RLS checks pass.
  SELECT u.email INTO user_email FROM auth.users u WHERE u.id = uid;

  IF user_email IS NOT NULL THEN
    IF req.requester_user_id IS NULL
       AND req.requester_email IS NOT NULL
       AND public.normalize_email(req.requester_email) = public.normalize_email(user_email)
    THEN
      UPDATE public.collab_requests
      SET requester_user_id = uid
      WHERE id = _request_id;
      linked := true;
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
