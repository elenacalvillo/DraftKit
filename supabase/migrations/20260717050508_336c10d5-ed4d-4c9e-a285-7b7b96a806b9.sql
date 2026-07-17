DROP FUNCTION IF EXISTS public.move_chapter_to_project(uuid, uuid);

CREATE FUNCTION public.move_chapter_to_project(_chapter_id uuid, _target_project_id uuid)
 RETURNS TABLE(moved_chapter_id uuid, moved_project_id uuid, moved_chapter_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT * INTO chapter_row FROM public.collab_requests cr WHERE cr.id = _chapter_id;
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

  UPDATE public.collab_requests AS cr
     SET project_id = _target_project_id,
         chapter_order = new_order
   WHERE cr.id = _chapter_id;

  IF old_order IS NOT NULL THEN
    UPDATE public.collab_requests AS cr
       SET chapter_order = cr.chapter_order - 1
     WHERE cr.project_id = old_project
       AND cr.is_project_workspace = true
       AND cr.chapter_order > old_order;
  END IF;

  moved_chapter_id := _chapter_id;
  moved_project_id := _target_project_id;
  moved_chapter_order := new_order;
  RETURN NEXT;
END;
$function$;