-- 1. Update link function to be case-insensitive
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE lower(requester_email) = lower(NEW.email)
    AND requester_user_id IS NULL;

  UPDATE public.workspace_collaborators
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email)
    AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- 2. Create the missing trigger on auth.users (zz_ prefix → runs last, after any profile-creation trigger)
DROP TRIGGER IF EXISTS zz_link_invites_on_signup ON auth.users;
CREATE TRIGGER zz_link_invites_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_requests_to_new_user();

-- 3. One-time backfill: link orphaned invites (case-insensitive)
UPDATE public.workspace_collaborators wc
SET user_id = u.id
FROM auth.users u
WHERE wc.user_id IS NULL AND lower(wc.email) = lower(u.email);

UPDATE public.collab_requests cr
SET requester_user_id = u.id
FROM auth.users u
WHERE cr.requester_user_id IS NULL AND lower(cr.requester_email) = lower(u.email);

-- 4. Enable realtime so the sidebar updates live when the trigger fires
ALTER TABLE public.workspace_collaborators REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_collaborators;