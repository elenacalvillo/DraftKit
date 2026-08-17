CREATE OR REPLACE FUNCTION public.add_project_member_by_creator(
  _project_id uuid,
  _creator_id uuid,
  _role text
)
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
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _email text;
BEGIN
  IF NOT (
    public.is_project_owner(auth.uid(), _project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = _project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized for this project';
  END IF;

  IF _role NOT IN ('admin', 'chapter_writer', 'peer_reviewer', 'cross_chapter_reviewer') THEN
    RAISE EXCEPTION 'Invalid project role';
  END IF;

  SELECT c.user_id INTO _user_id FROM public.creators c WHERE c.id = _creator_id;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Writer not found';
  END IF;

  SELECT public.normalize_email(u.email) INTO _email FROM auth.users u WHERE u.id = _user_id;
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Writer has no email on file';
  END IF;

  INSERT INTO public.project_members AS pm (project_id, user_id, email, role)
  VALUES (_project_id, _user_id, _email, _role)
  ON CONFLICT (project_id, email) DO UPDATE
    SET user_id = COALESCE(pm.user_id, EXCLUDED.user_id);

  RETURN QUERY
  SELECT pm.id, pm.project_id, pm.user_id, pm.email, pm.role, pm.invited_at, pm.joined_at
  FROM public.project_members pm
  WHERE pm.project_id = _project_id AND pm.email = _email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_project_member_by_creator(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_project_member_by_creator(uuid, uuid, text) TO authenticated;