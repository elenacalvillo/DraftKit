-- Normalize existing member emails, then drop duplicates keeping the oldest invite.
UPDATE public.project_members
SET email = public.normalize_email(email)
WHERE email <> public.normalize_email(email);

DELETE FROM public.project_members pm
USING public.project_members keep
WHERE pm.project_id = keep.project_id
  AND pm.email = keep.email
  AND pm.id <> keep.id
  AND (keep.invited_at < pm.invited_at
       OR (keep.invited_at = pm.invited_at AND keep.id < pm.id));

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_project_id_email_key UNIQUE (project_id, email);

CREATE OR REPLACE FUNCTION public.sync_collaborator_to_project_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
BEGIN
  SELECT cr.project_id INTO _project_id
  FROM public.collab_requests cr
  WHERE cr.id = NEW.request_id;

  IF _project_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_members (project_id, user_id, email, role, joined_at)
  VALUES (_project_id, NEW.user_id, public.normalize_email(NEW.email), 'chapter_writer', NEW.joined_at)
  ON CONFLICT (project_id, email) DO NOTHING;

  UPDATE public.project_members pm
  SET user_id   = COALESCE(pm.user_id, NEW.user_id),
      joined_at = COALESCE(pm.joined_at, NEW.joined_at)
  WHERE pm.project_id = _project_id
    AND pm.email = public.normalize_email(NEW.email);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_collaborator_to_project_member()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_collaborator_to_project_member
  ON public.workspace_collaborators;
CREATE TRIGGER trg_sync_collaborator_to_project_member
  AFTER INSERT OR UPDATE OF user_id, joined_at, email
  ON public.workspace_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_collaborator_to_project_member();

INSERT INTO public.project_members (project_id, user_id, email, role, invited_at, joined_at)
SELECT DISTINCT ON (cr.project_id, public.normalize_email(wc.email))
       cr.project_id,
       wc.user_id,
       public.normalize_email(wc.email),
       'chapter_writer',
       wc.invited_at,
       wc.joined_at
FROM public.workspace_collaborators wc
JOIN public.collab_requests cr ON cr.id = wc.request_id
WHERE cr.project_id IS NOT NULL
ORDER BY cr.project_id, public.normalize_email(wc.email), wc.invited_at
ON CONFLICT (project_id, email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_project_people(_project_id uuid)
RETURNS TABLE (
  request_id uuid,
  chapter_title text,
  chapter_order integer,
  email text,
  user_id uuid,
  name text,
  username text,
  profile_image_url text,
  joined_at timestamptz,
  source text,
  is_project_member boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  WITH people AS (
    SELECT cr.id AS p_request_id,
           cr.message AS p_chapter_title,
           cr.chapter_order AS p_chapter_order,
           public.normalize_email(wc.email) AS p_email,
           wc.user_id AS p_user_id,
           wc.joined_at AS p_joined_at,
           'collaborator'::text AS p_source
    FROM public.collab_requests cr
    JOIN public.workspace_collaborators wc ON wc.request_id = cr.id
    WHERE cr.project_id = _project_id
    UNION ALL
    SELECT cr.id,
           cr.message,
           cr.chapter_order,
           public.normalize_email(cr.requester_email),
           cr.requester_user_id,
           cr.approved_at,
           'requester'::text
    FROM public.collab_requests cr
    WHERE cr.project_id = _project_id
      AND cr.requester_email IS NOT NULL
      AND cr.is_solo = false
  )
  SELECT p.p_request_id,
         p.p_chapter_title,
         p.p_chapter_order,
         p.p_email,
         p.p_user_id,
         c.name,
         c.username,
         c.profile_image_url,
         p.p_joined_at,
         p.p_source,
         EXISTS (
           SELECT 1 FROM public.project_members pm
           WHERE pm.project_id = _project_id AND pm.email = p.p_email
         ) AS is_project_member
  FROM people p
  LEFT JOIN public.creators c ON c.user_id = p.p_user_id
  ORDER BY p.p_chapter_order NULLS LAST, p.p_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_project_people(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_project_people(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_hosted_participants()
RETURNS TABLE (
  request_id uuid,
  email text,
  user_id uuid,
  name text,
  joined_at timestamptz,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT cr.id, cr.project_id, cr.requester_email, cr.requester_user_id,
           cr.approved_at, cr.is_solo
    FROM public.collab_requests cr
    WHERE cr.creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
       OR (cr.project_id IS NOT NULL
           AND public.is_project_owner(auth.uid(), cr.project_id))
  )
  SELECT m.id,
         public.normalize_email(wc.email),
         wc.user_id,
         c.name,
         wc.joined_at,
         'collaborator'::text
  FROM mine m
  JOIN public.workspace_collaborators wc ON wc.request_id = m.id
  LEFT JOIN public.creators c ON c.user_id = wc.user_id
  UNION ALL
  SELECT m.id,
         public.normalize_email(m.requester_email),
         m.requester_user_id,
         c.name,
         m.approved_at,
         'requester'::text
  FROM mine m
  LEFT JOIN public.creators c ON c.user_id = m.requester_user_id
  WHERE m.requester_email IS NOT NULL AND m.is_solo = false;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_hosted_participants() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_hosted_participants() TO authenticated;