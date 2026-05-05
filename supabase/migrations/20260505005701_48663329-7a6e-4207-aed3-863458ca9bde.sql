DROP FUNCTION IF EXISTS public.get_public_sheet(uuid);

CREATE OR REPLACE FUNCTION public.get_public_sheet(_token uuid)
RETURNS TABLE(
  request_id uuid,
  shared_content text,
  creator_name text,
  creator_username text,
  creator_profile_image_url text,
  invite_message text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    cr.id,
    cr.shared_content,
    c.name,
    c.username,
    c.profile_image_url,
    NULL::text
  FROM public.collab_requests cr
  JOIN public.creators c ON c.id = cr.creator_id
  WHERE cr.view_token = _token
  LIMIT 1;
$$;