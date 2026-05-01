
-- =============================================================
-- 1) Insert-time linker for workspace_collaborators
-- If the invited email already belongs to an auth.users row,
-- set user_id immediately so RLS grants access right away.
-- =============================================================
CREATE OR REPLACE FUNCTION public.link_collaborator_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_collaborator_on_insert() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_link_collaborator_on_insert ON public.workspace_collaborators;
CREATE TRIGGER trg_link_collaborator_on_insert
  BEFORE INSERT ON public.workspace_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.link_collaborator_on_insert();

-- =============================================================
-- 2) Insert-time linker for collab_requests (replace the no-op)
-- Match requester_email to an existing auth.users row if the
-- requester is not already linked. Trigger already exists
-- (trg_link_request_to_existing_user) and points at this fn.
-- =============================================================
CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_user_id IS NULL AND NEW.requester_email IS NOT NULL THEN
    SELECT u.id INTO NEW.requester_user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(NEW.requester_email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_request_to_existing_user() FROM anon, authenticated, PUBLIC;

-- =============================================================
-- 3) One-time backfill of orphaned rows
-- =============================================================
UPDATE public.workspace_collaborators wc
SET user_id = u.id
FROM auth.users u
WHERE wc.user_id IS NULL
  AND lower(wc.email) = lower(u.email);

UPDATE public.collab_requests cr
SET requester_user_id = u.id
FROM auth.users u
WHERE cr.requester_user_id IS NULL
  AND cr.requester_email IS NOT NULL
  AND lower(cr.requester_email) = lower(u.email);
