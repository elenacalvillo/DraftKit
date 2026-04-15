-- 1. Update trigger to skip validation for solo drafts
CREATE OR REPLACE FUNCTION public.validate_requester_substack_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_solo IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.requester_substack_url LIKE '%substack.com/@%' THEN
    RAISE EXCEPTION 'Please use your publication URL (e.g., name.substack.com) instead of your profile URL.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Add dedicated solo workspace INSERT policy
CREATE POLICY "Creators can create solo workspaces"
ON public.collab_requests FOR INSERT TO authenticated
WITH CHECK (
  is_solo = true
  AND status = 'approved'
  AND auth.uid() = requester_user_id
  AND creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
);

-- 3. Drop the dangerous universal insert policy
DROP POLICY IF EXISTS "Universal Insert Policy" ON public.collab_requests;