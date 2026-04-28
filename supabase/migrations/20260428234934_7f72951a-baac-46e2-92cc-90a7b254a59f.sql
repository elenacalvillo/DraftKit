-- 1. Drop zombie policy that exposes all columns of creators (including stripe_customer_id, etc.)
DROP POLICY IF EXISTS "Public can read public creator columns" ON public.creators;

-- Public read access to safe columns is provided via the public_creator_profiles view.
-- Owners can still SELECT their own row via "Creators can view own profile".

-- 2. Idempotency for fulfill-credits to prevent Stripe session replay double-spend
CREATE TABLE IF NOT EXISTS public.fulfilled_stripe_sessions (
  stripe_session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  credits_added integer NOT NULL,
  fulfilled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fulfilled_stripe_sessions ENABLE ROW LEVEL SECURITY;

-- No client policies — only service role (which bypasses RLS) writes/reads this table.

-- 3. Restrict workspace collaborator updates on collab_requests to only safe columns.
DROP POLICY IF EXISTS "Collaborators can edit shared workspace" ON public.collab_requests;

CREATE POLICY "Collaborators can edit shared workspace content"
ON public.collab_requests
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT wc.request_id FROM public.workspace_collaborators wc WHERE wc.user_id = auth.uid())
  AND status = 'approved'
)
WITH CHECK (
  id IN (SELECT wc.request_id FROM public.workspace_collaborators wc WHERE wc.user_id = auth.uid())
  AND status = 'approved'
);

-- Trigger to enforce that collaborators (non-owners, non-requesters) can only modify
-- shared workspace content fields, never sensitive fields like email, notes, ai_draft, links.
CREATE OR REPLACE FUNCTION public.enforce_collaborator_field_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  is_requester boolean;
BEGIN
  -- Skip checks for service role / no auth context
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM creators c WHERE c.id = NEW.creator_id AND c.user_id = auth.uid()
  ) INTO is_owner;

  is_requester := (NEW.requester_user_id = auth.uid());

  -- Owners and requesters retain full edit rights as defined by their policies.
  IF is_owner OR is_requester THEN
    RETURN NEW;
  END IF;

  -- For everyone else (collaborators), block changes to sensitive fields.
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
  THEN
    RAISE EXCEPTION 'Collaborators can only edit shared workspace content fields';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_collaborator_field_restrictions() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_collaborator_field_restrictions ON public.collab_requests;
CREATE TRIGGER trg_enforce_collaborator_field_restrictions
BEFORE UPDATE ON public.collab_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_collaborator_field_restrictions();
