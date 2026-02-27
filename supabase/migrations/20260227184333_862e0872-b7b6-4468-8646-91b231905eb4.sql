
-- 1. Slash trial from 30 days to 7 days
CREATE OR REPLACE FUNCTION public.set_founder_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOW() < '2026-03-01'::TIMESTAMPTZ THEN
    NEW.subscription_tier := 'pro';
    NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Add retrospective columns to collab_requests
ALTER TABLE collab_requests
  ADD COLUMN IF NOT EXISTS retro_rating integer,
  ADD COLUMN IF NOT EXISTS retro_notes text,
  ADD COLUMN IF NOT EXISTS retro_completed_at timestamptz;

-- 3. Allow requesters to submit retro on published collabs
CREATE POLICY "Requesters can submit retro on published collabs"
ON collab_requests
FOR UPDATE
TO authenticated
USING (requester_user_id = auth.uid() AND status = 'published')
WITH CHECK (status = 'published');
