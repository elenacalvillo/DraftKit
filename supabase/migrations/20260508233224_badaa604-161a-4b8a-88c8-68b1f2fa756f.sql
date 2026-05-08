
REVOKE EXECUTE ON FUNCTION public.get_inactive_credit_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_nudge_count(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_inactive_credit_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_nudge_count(uuid) TO authenticated;
