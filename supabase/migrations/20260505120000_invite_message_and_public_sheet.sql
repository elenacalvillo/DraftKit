-- =============================================================
-- DRAFT-002: Add invite_message to collab_requests and update
-- the get_public_sheet RPC to surface it (alongside the
-- creator's profile_image_url) for the redesigned public
-- workspace view.
-- =============================================================

-- 1. Add nullable invite_message column to collab_requests.
--    All existing rows will have NULL — the front-end handles
--    that case with a fallback message.
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS invite_message text;

-- 2. Recreate get_public_sheet to include the two new fields:
--    - cr.invite_message
--    - c.profile_image_url
--
--    Existing fields (request_id, project_title, shared_content,
--    creator_name, creator_username) keep the exact same shape
--    so existing consumers continue to work.
--
--    Function remains SECURITY DEFINER and continues to scope
--    access by view_token, so no RLS change is required.
CREATE OR REPLACE FUNCTION public.get_public_sheet(_token uuid)
RETURNS TABLE (
  request_id uuid,
  project_title text,
  shared_content text,
  creator_name text,
  creator_username text,
  creator_profile_image_url text,
  invite_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cr.id AS request_id,
    COALESCE(NULLIF(btrim(cr.selected_collab_type), ''), 'Untitled draft') AS project_title,
    cr.shared_content,
    c.name AS creator_name,
    c.username AS creator_username,
    c.profile_image_url AS creator_profile_image_url,
    cr.invite_message AS invite_message
  FROM public.collab_requests cr
  JOIN public.creators c ON c.id = cr.creator_id
  WHERE cr.view_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_sheet(uuid) TO anon, authenticated;
