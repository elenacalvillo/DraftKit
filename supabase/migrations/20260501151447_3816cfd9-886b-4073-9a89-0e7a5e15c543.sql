-- ============================================================
-- Repair collaboration access: identity reconciliation, joined_at,
-- and safer presence handling. No RLS rollback.
-- ============================================================

-- 1) Stronger email normalization helper.
-- Lowercases + trims and (for gmail/googlemail) strips dots in the
-- local-part and any "+tag" alias. Other providers only get the
-- lowercase/trim normalization. This is a safe, well-known pattern
-- to handle the most common email-identity mismatches that strand
-- legitimate participants.
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  e text;
  local_part text;
  domain_part text;
  at_pos int;
BEGIN
  IF _email IS NULL THEN RETURN NULL; END IF;
  e := lower(btrim(_email));
  at_pos := position('@' in e);
  IF at_pos = 0 THEN RETURN e; END IF;
  local_part := substring(e from 1 for at_pos - 1);
  domain_part := substring(e from at_pos + 1);

  -- Strip + alias for everyone (RFC-friendly, broadly safe)
  local_part := split_part(local_part, '+', 1);

  -- For gmail / googlemail, dots in the local-part are insignificant
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := replace(local_part, '.', '');
    domain_part := 'gmail.com';
  END IF;

  RETURN local_part || '@' || domain_part;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_email(text) FROM anon, authenticated, PUBLIC;

-- 2) Update insert-time linkers to use normalize_email so that small
-- variations (e.g. extra dots in gmail addresses, "+tag" aliases)
-- still match an existing auth.users row.
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
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.email)
    LIMIT 1;
  END IF;

  -- Stamp joined_at when we successfully link to a real user on insert.
  IF NEW.user_id IS NOT NULL AND NEW.joined_at IS NULL THEN
    NEW.joined_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_collaborator_on_insert() FROM anon, authenticated, PUBLIC;

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
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.requester_email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_request_to_existing_user() FROM anon, authenticated, PUBLIC;

-- 3) On-signup linker (auth.users AFTER INSERT) uses the same
-- normalization, and stamps joined_at for collaborators it links.
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE requester_user_id IS NULL
    AND public.normalize_email(requester_email) = public.normalize_email(NEW.email);

  UPDATE public.workspace_collaborators
  SET user_id = NEW.id,
      joined_at = COALESCE(joined_at, now())
  WHERE user_id IS NULL
    AND public.normalize_email(email) = public.normalize_email(NEW.email);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_requests_to_new_user() FROM anon, authenticated, PUBLIC;

-- 4) New stamp_collaborator_joined RPC. Authenticated users can call
-- it to mark themselves as joined when they open a workspace they
-- already have access to. Internal SECURITY DEFINER, narrow scope.
CREATE OR REPLACE FUNCTION public.stamp_collaborator_joined(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  UPDATE public.workspace_collaborators
  SET joined_at = COALESCE(joined_at, now())
  WHERE request_id = _request_id
    AND user_id = uid
    AND joined_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stamp_collaborator_joined(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_collaborator_joined(uuid) FROM anon, PUBLIC;

-- 5) One-time backfills using the new normalizer.
UPDATE public.workspace_collaborators wc
SET user_id = u.id,
    joined_at = COALESCE(wc.joined_at, now())
FROM auth.users u
WHERE wc.user_id IS NULL
  AND public.normalize_email(wc.email) = public.normalize_email(u.email);

UPDATE public.collab_requests cr
SET requester_user_id = u.id
FROM auth.users u
WHERE cr.requester_user_id IS NULL
  AND cr.requester_email IS NOT NULL
  AND public.normalize_email(cr.requester_email) = public.normalize_email(u.email);

-- Also stamp joined_at for already-linked collaborator rows that
-- never received a join timestamp, so the UI stops showing real
-- members as "Pending" forever.
UPDATE public.workspace_collaborators
SET joined_at = now()
WHERE user_id IS NOT NULL
  AND joined_at IS NULL;

-- 6) Stop using 1970-01-01 as a fake "offline" sentinel.
-- We delete the user's presence row when they stop editing.
-- Allow each user to delete their own presence rows.
DROP POLICY IF EXISTS "Users can delete own presence" ON public.workspace_presence;
CREATE POLICY "Users can delete own presence"
ON public.workspace_presence
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Clean up the historical 1970 sentinels.
DELETE FROM public.workspace_presence
WHERE last_active_at <= TIMESTAMPTZ '1970-01-02 00:00:00+00';