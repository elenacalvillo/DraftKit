ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS publish_prompt_suppressed_at timestamptz;

-- Narrow allowance: any confirmed workspace participant may change only the
-- publish-related columns. Everything else still falls through to the
-- existing per-role column allow-lists below.
CREATE OR REPLACE FUNCTION public.enforce_collaborator_field_restrictions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_owner boolean;
  is_requester boolean;
  is_collaborator boolean;
  publish_cols text[] := ARRAY['status','collab_link','requester_collab_link','publish_prompt_suppressed_at'];
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Publish-only update by a confirmed participant.
  IF (to_jsonb(NEW) - publish_cols) = (to_jsonb(OLD) - publish_cols)
     AND NEW.status IN ('approved','published')
     AND OLD.status IN ('approved','published')
     AND public.has_workspace_access(uid, NEW.id)
  THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM creators c WHERE c.id = NEW.creator_id AND c.user_id = uid
  ) INTO is_owner;

  is_requester := (NEW.requester_user_id = uid) OR (OLD.requester_user_id = uid);

  SELECT EXISTS (
    SELECT 1 FROM workspace_collaborators wc
    WHERE wc.request_id = NEW.id AND wc.user_id = uid
  ) INTO is_collaborator;

  IF is_owner THEN
    IF NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
       OR NEW.requester_email IS DISTINCT FROM OLD.requester_email
       OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
       OR NEW.requester_substack_url IS DISTINCT FROM OLD.requester_substack_url
       OR NEW.requester_profile_image_url IS DISTINCT FROM OLD.requester_profile_image_url
       OR NEW.requester_collab_link IS DISTINCT FROM OLD.requester_collab_link
       OR NEW.retro_rating IS DISTINCT FROM OLD.retro_rating
       OR NEW.retro_notes IS DISTINCT FROM OLD.retro_notes
       OR NEW.retro_completed_at IS DISTINCT FROM OLD.retro_completed_at
       OR NEW.view_token IS DISTINCT FROM OLD.view_token
       OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Host cannot modify requester identity, retro submission, view token, or row ownership';
    END IF;
    RETURN NEW;
  END IF;

  IF is_requester THEN
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
       OR NEW.requester_email IS DISTINCT FROM OLD.requester_email
       OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
       OR NEW.requester_substack_url IS DISTINCT FROM OLD.requester_substack_url
       OR NEW.requester_profile_image_url IS DISTINCT FROM OLD.requester_profile_image_url
       OR NEW.creator_notes IS DISTINCT FROM OLD.creator_notes
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
       OR NEW.first_draft_generated_at IS DISTINCT FROM OLD.first_draft_generated_at
       OR NEW.hidden_by_creator IS DISTINCT FROM OLD.hidden_by_creator
       OR NEW.view_token IS DISTINCT FROM OLD.view_token
       OR NEW.is_solo IS DISTINCT FROM OLD.is_solo
       OR NEW.is_project_workspace IS DISTINCT FROM OLD.is_project_workspace
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.requested_date IS DISTINCT FROM OLD.requested_date
       OR NEW.selected_collab_type IS DISTINCT FROM OLD.selected_collab_type
       OR NEW.ai_draft IS DISTINCT FROM OLD.ai_draft
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Requester can only edit shared draft, editing sessions, their own retro, the published collab link, and their hide flag';
    END IF;
    RETURN NEW;
  END IF;

  IF is_collaborator THEN
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
  END IF;

  RAISE EXCEPTION 'Not authorized to update this collab request';
END;
$function$;

-- Any confirmed participant can flip an approved workspace to published and
-- record post links. RLS policies freeze status for guests, so this definer
-- function is the sanctioned path.
CREATE OR REPLACE FUNCTION public.mark_workspace_published(
  _request_id uuid,
  _host_url text DEFAULT NULL,
  _guest_url text DEFAULT NULL
)
RETURNS TABLE(id uuid, status text, collab_link text, requester_collab_link text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  RETURNING cr.id, cr.status, cr.collab_link, cr.requester_collab_link
  INTO id, status, collab_link, requester_collab_link;

  IF id IS NULL THEN
    RAISE EXCEPTION 'Workspace is not in a publishable state';
  END IF;

  RETURN NEXT;
END;
$$;

-- Persist the publish-prompt answer on the row so dismissal is not
-- per-browser. _response: 'not_publishing' suppresses, 'reset' clears.
CREATE OR REPLACE FUNCTION public.set_publish_prompt_response(
  _request_id uuid,
  _response text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  result timestamptz;
BEGIN
  IF uid IS NULL OR NOT public.has_workspace_access(uid, _request_id) THEN
    RAISE EXCEPTION 'Not authorized for this workspace';
  END IF;

  IF _response NOT IN ('not_publishing', 'reset') THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;

  UPDATE public.collab_requests
  SET publish_prompt_suppressed_at = CASE WHEN _response = 'not_publishing' THEN now() ELSE NULL END
  WHERE collab_requests.id = _request_id
  RETURNING publish_prompt_suppressed_at INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_workspace_published(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_publish_prompt_response(uuid, text) TO authenticated;