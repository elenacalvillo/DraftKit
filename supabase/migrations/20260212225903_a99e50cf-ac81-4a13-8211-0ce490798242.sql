
-- 1. Drop the CHECK constraint that blocks updates on legacy rows
ALTER TABLE public.collab_requests DROP CONSTRAINT IF EXISTS collab_requests_requester_url_no_profile;

-- 2. Create a trigger function that validates only on INSERT
CREATE OR REPLACE FUNCTION public.validate_requester_substack_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requester_substack_url LIKE '%substack.com/@%' THEN
    RAISE EXCEPTION 'Please use your publication URL (e.g., name.substack.com) instead of your profile URL.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Attach as BEFORE INSERT trigger
CREATE TRIGGER trg_validate_requester_url
BEFORE INSERT ON public.collab_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_requester_substack_url();
