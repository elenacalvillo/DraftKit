CREATE OR REPLACE FUNCTION public.list_my_workspaces()
 RETURNS TABLE(request_id uuid, role_in_workspace text, status text, is_project_workspace boolean, is_solo boolean, project_id uuid, project_title text, chapter_title text, chapter_order integer, message text, requested_date date, created_at timestamp with time zone, approved_at timestamp with time zone, content_last_edited_at timestamp with time zone, content_last_edited_by text, collab_link text, host_creator_id uuid, host_name text, host_username text, host_profile_image_url text, requester_user_id uuid, requester_name text, requester_email text, requester_profile_image_url text, joined_at timestamp with time zone, hidden_by_creator boolean, hidden_by_requester boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  base AS (
    -- Host (creator) owned workspaces.
    -- Exclude solo, unshared book chapters (no external collaborator, no external requester).
    SELECT cr.id AS request_id,
           'host'::text AS role_in_workspace,
           NULL::timestamp with time zone AS joined_at
    FROM public.collab_requests cr
    JOIN public.creators c ON c.id = cr.creator_id
    WHERE c.user_id = (SELECT uid FROM me)
      AND cr.hidden_by_creator = false
      AND (
        COALESCE(cr.is_project_workspace, false) = false
        OR EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id
            AND (wc.user_id IS NULL OR wc.user_id <> (SELECT uid FROM me))
        )
        OR (cr.requester_user_id IS NOT NULL AND cr.requester_user_id <> (SELECT uid FROM me))
      )
    UNION
    -- Requester (outgoing pitches or self-assigned chapters where they are the requester)
    SELECT cr.id, 'requester'::text, NULL::timestamp with time zone
    FROM public.collab_requests cr
    WHERE cr.requester_user_id = (SELECT uid FROM me)
      AND cr.hidden_by_requester = false
    UNION
    -- Invited collaborator
    SELECT wc.request_id, 'collaborator'::text, wc.joined_at
    FROM public.workspace_collaborators wc
    WHERE wc.user_id = (SELECT uid FROM me)
    UNION
    -- Project owner: chapters within a book they own, ONLY when actually shared with someone else.
    SELECT cr.id, 'project_owner'::text, NULL::timestamp with time zone
    FROM public.collab_requests cr
    JOIN public.projects p ON p.id = cr.project_id
    JOIN public.creators c ON c.id = p.creator_id
    WHERE cr.is_project_workspace = true
      AND c.user_id = (SELECT uid FROM me)
      AND cr.hidden_by_creator = false
      AND (
        EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id
            AND (wc.user_id IS NULL OR wc.user_id <> (SELECT uid FROM me))
        )
        OR (cr.requester_user_id IS NOT NULL AND cr.requester_user_id <> (SELECT uid FROM me))
      )
  ),
  ranked AS (
    SELECT request_id,
           role_in_workspace,
           joined_at,
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
    COALESCE(cr.hidden_by_requester, false)
  FROM deduped d
  JOIN public.collab_requests cr ON cr.id = d.request_id
  JOIN public.creators host ON host.id = cr.creator_id
  LEFT JOIN public.projects p ON p.id = cr.project_id
  WHERE (SELECT uid FROM me) IS NOT NULL
  ORDER BY COALESCE(cr.content_last_edited_at, cr.approved_at, cr.created_at) DESC NULLS LAST;
$function$;