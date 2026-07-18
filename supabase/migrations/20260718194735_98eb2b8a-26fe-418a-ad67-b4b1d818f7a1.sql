
REVOKE EXECUTE ON FUNCTION public.is_comment_only_reviewer(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._normalize_for_comment_diff(text) FROM anon, PUBLIC;
