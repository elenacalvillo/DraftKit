CREATE OR REPLACE FUNCTION public.mark_workspace_published(_request_id uuid, _host_url text DEFAULT NULL::text, _guest_url text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, status text, collab_link text, requester_collab_link text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_workspace_access(uid, _request_id) THEN
    RAISE EXCEPTION 'Not authorized for this workspace';
  END IF;

  UPDATE public.collab_requests cr
  SET status = 'published',
      collab_link = COALESCE(NULLIF(btrim(_host_url), ''), cr.collab_link),
      requester_collab_link = COALESCE(NULLIF(btrim(_guest_url), ''), cr.requester_collab_link)
  WHERE cr.id = _request_id
    AND cr.status IN ('approved', 'published')
    AND COALESCE(cr.is_project_workspace, false) = false
  RETURNING cr.id, cr.status, cr.collab_link, cr.requester_collab_link
  INTO id, status, collab_link, requester_collab_link;

  IF id IS NULL THEN
    RAISE EXCEPTION 'Workspace is not in a publishable state';
  END IF;

  RETURN NEXT;
END;
$function$;