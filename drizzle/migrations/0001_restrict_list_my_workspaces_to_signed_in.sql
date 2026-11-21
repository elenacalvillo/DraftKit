REVOKE ALL ON FUNCTION public.list_my_workspaces() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_workspaces() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO service_role;