DROP TRIGGER IF EXISTS trg_enforce_active_project_limit ON public.projects;
DROP FUNCTION IF EXISTS public.enforce_active_project_limit();