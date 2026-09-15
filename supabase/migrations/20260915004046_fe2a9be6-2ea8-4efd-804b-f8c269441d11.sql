REVOKE ALL ON FUNCTION public.mark_workspace_published(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_publish_prompt_response(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_workspace_published(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_publish_prompt_response(uuid, text) TO authenticated;