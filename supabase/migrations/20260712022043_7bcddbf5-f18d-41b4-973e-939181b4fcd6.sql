CREATE OR REPLACE FUNCTION public.list_my_collaborator_workspaces()
RETURNS TABLE (
  request_id uuid,
  role text,
  joined_at timestamptz,
  status text,
  is_project_workspace boolean,
  project_id uuid,
  project_title text,
  chapter_title text,
  chapter_order integer,
  content_last_edited_at timestamptz,
  content_last_edited_by text,
  host_name text,
  host_username text,
  host_profile_image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wc.request_id,
    wc.role,
    wc.joined_at,
    cr.status,
    COALESCE(cr.is_project_workspace, false) AS is_project_workspace,
    cr.project_id,
    p.title AS project_title,
    cr.message AS chapter_title,
    cr.chapter_order,
    cr.content_last_edited_at,
    cr.content_last_edited_by,
    c.name AS host_name,
    c.username AS host_username,
    c.profile_image_url AS host_profile_image_url
  FROM public.workspace_collaborators wc
  JOIN public.collab_requests cr ON cr.id = wc.request_id
  JOIN public.creators c ON c.id = cr.creator_id
  LEFT JOIN public.projects p ON p.id = cr.project_id
  WHERE wc.user_id = auth.uid()
    AND auth.uid() IS NOT NULL
    AND cr.status NOT IN ('cancelled', 'declined')
  ORDER BY
    COALESCE(cr.content_last_edited_at, wc.joined_at, cr.created_at) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_collaborator_workspaces() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_my_collaborator_workspaces() FROM anon, PUBLIC;