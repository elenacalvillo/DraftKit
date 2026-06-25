
-- Replace the collaborator-only field guard with a stricter, role-aware
-- version that ALSO clamps what the requester and the host (creator) can
-- write through the existing UPDATE policies. Each role has an explicit
-- allow-list; anything outside it raises.
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
BEGIN
  -- Service-role / background jobs (auth.uid() IS NULL) bypass; RLS
  -- already gates user requests, this trigger only narrows allowed
  -- columns within an allowed UPDATE.
  IF uid IS NULL THEN
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

  ----------------------------------------------------------------------
  -- HOST / OWNER: broad control over their own request, but cannot
  -- silently rewrite the requester's identity or the requester's
  -- retro submission.
  ----------------------------------------------------------------------
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

  ----------------------------------------------------------------------
  -- REQUESTER: allow-list of columns they can change post-approval
  -- (workspace edits, their own retro, hiding their copy, posting the
  -- link they published). Everything else must stay frozen.
  ----------------------------------------------------------------------
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

  ----------------------------------------------------------------------
  -- COLLABORATOR: shared draft + editing sessions ONLY.
  ----------------------------------------------------------------------
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

  -- No recognised role for this user on this row: fail closed.
  RAISE EXCEPTION 'Not authorized to update this collab request';
END;
$function$;
