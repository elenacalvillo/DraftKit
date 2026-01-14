-- Fix 1: Link existing orphaned requests to their users
UPDATE public.collab_requests cr
SET requester_user_id = c.user_id
FROM public.creators c
WHERE cr.requester_email = c.email
  AND cr.requester_user_id IS NULL;

-- Fix 2: Create trigger to auto-link requests on INSERT
CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only if requester_user_id is not already set
  IF NEW.requester_user_id IS NULL THEN
    -- Try to find a matching creator by email
    SELECT user_id INTO NEW.requester_user_id
    FROM public.creators
    WHERE email = NEW.requester_email
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on INSERT (use CREATE OR REPLACE pattern for trigger)
DROP TRIGGER IF EXISTS trg_link_request_to_existing_user ON public.collab_requests;

CREATE TRIGGER trg_link_request_to_existing_user
  BEFORE INSERT ON public.collab_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.link_request_to_existing_user();