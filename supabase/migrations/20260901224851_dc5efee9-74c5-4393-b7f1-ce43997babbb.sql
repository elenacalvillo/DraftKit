CREATE OR REPLACE FUNCTION public.list_workspace_participants(_request_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  user_id uuid,
  invited_at timestamptz,
  joined_at timestamptz,
  name text,
  username text,
  profile_image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wc.id,
    wc.email,
    wc.role,
    wc.user_id,
    wc.invited_at,
    wc.joined_at,
    c.name,
    c.username,
    c.profile_image_url
  FROM public.workspace_collaborators wc
  LEFT JOIN public.creators c ON c.user_id = wc.user_id
  WHERE wc.request_id = _request_id
    AND public.has_workspace_access(auth.uid(), _request_id)
  ORDER BY wc.invited_at ASC
$$;

GRANT EXECUTE ON FUNCTION public.list_workspace_participants(uuid) TO authenticated;