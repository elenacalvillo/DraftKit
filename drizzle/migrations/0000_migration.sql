CREATE OR REPLACE FUNCTION public.is_comment_only_reviewer(_user_id uuid, _request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cr AS (
    SELECT r.id, r.project_id, c.user_id AS owner_id
    FROM public.collab_requests r
    JOIN public.creators c ON c.id = r.creator_id
    WHERE r.id = _request_id AND r.is_project_workspace = true
  )
  SELECT EXISTS (
    SELECT 1 FROM cr
    WHERE _user_id IS NOT NULL
      AND _user_id <> cr.owner_id
      AND COALESCE(public.project_role(_user_id, cr.project_id), '') NOT IN ('owner', 'admin')
      AND (
        -- Project-wide reviewer roles are always comment-only.
        EXISTS (SELECT 1 FROM public.project_members pm
                WHERE pm.project_id = cr.project_id AND pm.user_id = _user_id
                  AND pm.role IN ('peer_reviewer', 'cross_chapter_reviewer'))
        -- Otherwise only the chapter author (first invited non-owner) edits.
        OR _user_id IS DISTINCT FROM (
          SELECT wc.user_id FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id
            AND (wc.user_id IS NULL OR wc.user_id <> cr.owner_id)
          ORDER BY wc.invited_at ASC, wc.id ASC
          LIMIT 1
        )
      )
  );
$function$;