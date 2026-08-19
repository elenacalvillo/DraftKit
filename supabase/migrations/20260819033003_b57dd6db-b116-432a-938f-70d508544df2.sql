CREATE OR REPLACE FUNCTION public.leave_workspace(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  req record;
  is_owner boolean;
  removed_collab boolean := false;
  hid_requester boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT cr.id, cr.creator_id, cr.requester_user_id
    INTO req
  FROM public.collab_requests cr
  WHERE cr.id = _request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.creators c WHERE c.id = req.creator_id AND c.user_id = uid
  ) INTO is_owner;

  IF is_owner THEN
    RAISE EXCEPTION 'host_cannot_leave' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.workspace_collaborators wc
  WHERE wc.request_id = _request_id AND wc.user_id = uid;
  removed_collab := FOUND;

  IF req.requester_user_id = uid THEN
    UPDATE public.collab_requests cr
    SET hidden_by_requester = true
    WHERE cr.id = _request_id;
    hid_requester := true;
  END IF;

  IF NOT removed_collab AND NOT hid_requester THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.workspace_presence wp
  WHERE wp.request_id = _request_id AND wp.user_id = uid;

  DELETE FROM public.workspace_reads wr
  WHERE wr.request_id = _request_id AND wr.user_id = uid;

  RETURN jsonb_build_object(
    'left', true,
    'removed_collaborator', removed_collab,
    'hidden_for_requester', hid_requester
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_workspace(uuid) TO authenticated;