-- Add requester_user_id column to link requests to user accounts
ALTER TABLE public.collab_requests 
ADD COLUMN requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_collab_requests_requester_user_id 
ON public.collab_requests(requester_user_id);

-- Allow requesters to view their own sent requests
CREATE POLICY "Requesters can view their own requests"
ON public.collab_requests FOR SELECT
TO authenticated
USING (requester_user_id = auth.uid());

-- Function to auto-link existing requests when user signs up with same email
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any existing collab requests to this new user
  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE requester_email = NEW.email
    AND requester_user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Trigger to run after new user creation
CREATE TRIGGER on_auth_user_created_link_requests
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.link_requests_to_new_user();