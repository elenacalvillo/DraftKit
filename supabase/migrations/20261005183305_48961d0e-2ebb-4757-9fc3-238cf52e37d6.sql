CREATE OR REPLACE FUNCTION public.project_role(_user_id uuid, _project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _project_id IS NULL THEN NULL
    -- Signed-in callers may only resolve their own role; service jobs (no auth.uid) may resolve anyone.
    WHEN auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN NULL
    WHEN public.is_project_owner(_user_id, _project_id) THEN 'owner'
    ELSE (
      SELECT pm.role FROM public.project_members pm
      WHERE pm.project_id = _project_id AND pm.user_id = _user_id
      ORDER BY CASE pm.role WHEN 'admin' THEN 1 WHEN 'cross_chapter_reviewer' THEN 2
                            WHEN 'chapter_writer' THEN 3 ELSE 4 END
      LIMIT 1)
  END;
$$;