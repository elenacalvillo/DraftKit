-- 1. Add view_token column with auto-generated UUID for all rows (existing + new)
ALTER TABLE public.collab_requests
  ADD COLUMN view_token uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.collab_requests
  ADD CONSTRAINT collab_requests_view_token_key UNIQUE (view_token);

-- 2. Public read-only RPC: returns ONLY safe display fields, no PII
CREATE OR REPLACE FUNCTION public.get_public_sheet(_token uuid)
RETURNS TABLE (
  request_id uuid,
  project_title text,
  shared_content text,
  creator_name text,
  creator_username text
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
    c.username AS creator_username
  FROM public.collab_requests cr
  JOIN public.creators c ON c.id = cr.creator_id
  WHERE cr.view_token = _token
  LIMIT 1;
$$;

-- Allow anonymous + authenticated callers
GRANT EXECUTE ON FUNCTION public.get_public_sheet(uuid) TO anon, authenticated;