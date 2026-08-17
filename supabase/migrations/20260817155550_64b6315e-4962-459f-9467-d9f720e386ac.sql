-- 1) Having an account is not acceptance: stop auto-stamping joined_at.
CREATE OR REPLACE FUNCTION public.link_project_member_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Explicit acceptance by the invited person.
CREATE OR REPLACE FUNCTION public.accept_project_invite(_project_id uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  user_id uuid,
  email text,
  role text,
  invited_at timestamptz,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _member_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.normalize_email(u.email) INTO _email
  FROM auth.users u WHERE u.id = _uid;

  SELECT pm.id INTO _member_id
  FROM public.project_members pm
  WHERE pm.project_id = _project_id
    AND (pm.user_id = _uid OR pm.email = _email)
  ORDER BY pm.invited_at
  LIMIT 1;

  IF _member_id IS NULL THEN
    RAISE EXCEPTION 'No invitation found for this account';
  END IF;

  UPDATE public.project_members pm
  SET joined_at = COALESCE(pm.joined_at, now()),
      user_id = COALESCE(pm.user_id, _uid)
  WHERE pm.id = _member_id;

  RETURN QUERY
  SELECT pm.id, pm.project_id, pm.user_id, pm.email, pm.role, pm.invited_at, pm.joined_at
  FROM public.project_members pm
  WHERE pm.id = _member_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_project_invite(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_invite(uuid) TO authenticated;

-- 3) Reset falsely "joined" members: keep only those with a real chapter join.
UPDATE public.project_members pm
SET joined_at = NULL
WHERE pm.joined_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.collab_requests cr
    JOIN public.workspace_collaborators wc ON wc.request_id = cr.id
    WHERE cr.project_id = pm.project_id
      AND public.normalize_email(wc.email) = pm.email
      AND wc.joined_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.collab_requests cr
    WHERE cr.project_id = pm.project_id
      AND cr.requester_user_id IS NOT NULL
      AND cr.requester_user_id = pm.user_id
      AND cr.is_solo = false
  );