-- Invites link to an account only once its email address is confirmed.
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE requester_user_id IS NULL
    AND public.normalize_email(requester_email) = public.normalize_email(NEW.email);

  UPDATE public.workspace_collaborators
  SET user_id = NEW.id,
      joined_at = COALESCE(joined_at, now())
  WHERE user_id IS NULL
    AND public.normalize_email(email) = public.normalize_email(NEW.email);

  UPDATE public.project_members
  SET user_id = NEW.id,
      joined_at = COALESCE(joined_at, now())
  WHERE user_id IS NULL
    AND public.normalize_email(email) = public.normalize_email(NEW.email);

  RETURN NEW;
END;
$function$;

-- Link pending invites at the moment an email address gets confirmed.
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_link_invites ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_link_invites
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.link_requests_to_new_user();

CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.requester_user_id IS NULL AND NEW.requester_email IS NOT NULL THEN
    SELECT u.id INTO NEW.requester_user_id
    FROM auth.users u
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.requester_email)
      AND u.email_confirmed_at IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_collaborator_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.email)
      AND u.email_confirmed_at IS NOT NULL
    LIMIT 1;
  END IF;

  IF NEW.user_id IS NOT NULL AND NEW.joined_at IS NULL THEN
    NEW.joined_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_project_member_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE public.normalize_email(u.email) = public.normalize_email(NEW.email)
      AND u.email_confirmed_at IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_project_invite(_project_id uuid)
 RETURNS TABLE(id uuid, project_id uuid, user_id uuid, email text, role text, invited_at timestamp with time zone, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _confirmed boolean;
  _member_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.normalize_email(u.email), (u.email_confirmed_at IS NOT NULL)
    INTO _email, _confirmed
  FROM auth.users u WHERE u.id = _uid;

  SELECT pm.id INTO _member_id
  FROM public.project_members pm
  WHERE pm.project_id = _project_id
    AND (pm.user_id = _uid OR (COALESCE(_confirmed, false) AND pm.email = _email))
  ORDER BY pm.invited_at
  LIMIT 1;

  IF _member_id IS NULL THEN
    IF NOT COALESCE(_confirmed, false) THEN
      RAISE EXCEPTION 'Please confirm your email address first';
    END IF;
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
$function$;