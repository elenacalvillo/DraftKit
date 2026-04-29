
-- 1. Cleanup: ensure no legacy public-read policies on creators remain
DROP POLICY IF EXISTS "Public can read public creator columns" ON public.creators;
DROP POLICY IF EXISTS "Public profile columns readable" ON public.creators;
DROP POLICY IF EXISTS "Public can view creators with username" ON public.creators;

-- 2. Remove broad collaborator SELECT on collab_requests (exposed requester PII)
DROP POLICY IF EXISTS "Collaborators can view invited requests" ON public.collab_requests;

-- 3. Safe RPC: returns the request row with PII fields nulled for collaborators.
--    Creator and requester get full row (matching existing RLS).
CREATE OR REPLACE FUNCTION public.get_workspace_request(_request_id uuid)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  requester_user_id uuid,
  requester_name text,
  requester_email text,
  requester_substack_url text,
  requester_profile_image_url text,
  requester_collab_link text,
  message text,
  requested_date date,
  status text,
  created_at timestamptz,
  ai_draft jsonb,
  collab_link text,
  shared_content text,
  content_last_edited_by text,
  content_last_edited_at timestamptz,
  selected_collab_type text,
  is_solo boolean,
  editing_sessions jsonb,
  first_draft_generated_at timestamptz,
  creator_notes text,
  approved_at timestamptz,
  view_token uuid,
  retro_rating integer,
  retro_notes text,
  retro_completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_owner boolean := false;
  is_requester boolean := false;
  is_collab boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM collab_requests cr
    JOIN creators c ON c.id = cr.creator_id
    WHERE cr.id = _request_id AND c.user_id = uid
  ) INTO is_owner;

  SELECT EXISTS (
    SELECT 1 FROM collab_requests cr
    WHERE cr.id = _request_id AND cr.requester_user_id = uid
  ) INTO is_requester;

  SELECT EXISTS (
    SELECT 1 FROM workspace_collaborators wc
    WHERE wc.request_id = _request_id AND wc.user_id = uid
  ) INTO is_collab;

  IF NOT (is_owner OR is_requester OR is_collab) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cr.id,
    cr.creator_id,
    cr.requester_user_id,
    -- Hide requester PII from collaborator-only viewers
    CASE WHEN is_owner OR is_requester THEN cr.requester_name ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_email ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_substack_url ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_profile_image_url ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_collab_link ELSE NULL END,
    cr.message,
    cr.requested_date,
    cr.status,
    cr.created_at,
    -- AI draft is workspace-internal; collaborators may need it for context
    cr.ai_draft,
    cr.collab_link,
    cr.shared_content,
    cr.content_last_edited_by,
    cr.content_last_edited_at,
    cr.selected_collab_type,
    cr.is_solo,
    cr.editing_sessions,
    cr.first_draft_generated_at,
    -- Private creator notes only for owner
    CASE WHEN is_owner THEN cr.creator_notes ELSE NULL END,
    cr.approved_at,
    -- View token only for owner/requester
    CASE WHEN is_owner OR is_requester THEN cr.view_token ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.retro_rating ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.retro_notes ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.retro_completed_at ELSE NULL END
  FROM collab_requests cr
  WHERE cr.id = _request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_request(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_workspace_request(uuid) FROM anon, PUBLIC;

-- 4. Tighten collaborator edit trigger: collaborators may ONLY change shared content fields.
CREATE OR REPLACE FUNCTION public.enforce_collaborator_field_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_owner boolean;
  is_requester boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM creators c WHERE c.id = NEW.creator_id AND c.user_id = uid
  ) INTO is_owner;

  is_requester := (NEW.requester_user_id = uid);

  IF is_owner OR is_requester THEN
    RETURN NEW;
  END IF;

  -- Collaborator-only path: allow ONLY the four shared-content columns to change.
  IF NEW.requester_email IS DISTINCT FROM OLD.requester_email
     OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
     OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
     OR NEW.requester_substack_url IS DISTINCT FROM OLD.requester_substack_url
     OR NEW.requester_profile_image_url IS DISTINCT FROM OLD.requester_profile_image_url
     OR NEW.requester_collab_link IS DISTINCT FROM OLD.requester_collab_link
     OR NEW.creator_notes IS DISTINCT FROM OLD.creator_notes
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.ai_draft IS DISTINCT FROM OLD.ai_draft
     OR NEW.collab_link IS DISTINCT FROM OLD.collab_link
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.view_token IS DISTINCT FROM OLD.view_token
     OR NEW.hidden_by_creator IS DISTINCT FROM OLD.hidden_by_creator
     OR NEW.hidden_by_requester IS DISTINCT FROM OLD.hidden_by_requester
     OR NEW.retro_rating IS DISTINCT FROM OLD.retro_rating
     OR NEW.retro_notes IS DISTINCT FROM OLD.retro_notes
     OR NEW.retro_completed_at IS DISTINCT FROM OLD.retro_completed_at
     OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
     OR NEW.requested_date IS DISTINCT FROM OLD.requested_date
     OR NEW.is_solo IS DISTINCT FROM OLD.is_solo
     OR NEW.selected_collab_type IS DISTINCT FROM OLD.selected_collab_type
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.first_draft_generated_at IS DISTINCT FROM OLD.first_draft_generated_at
  THEN
    RAISE EXCEPTION 'Collaborators can only edit shared workspace content fields';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_collaborator_field_restrictions() FROM anon, authenticated, PUBLIC;
