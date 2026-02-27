-- Disable identity matching on booking insert to prevent RLS conflicts.
-- Reconciliation is handled exclusively by link_requests_to_new_user on sign-up.
CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- No-op: Account Blindness means we never auto-link at insert time.
  -- The link_requests_to_new_user trigger handles reconciliation on sign-up.
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.link_request_to_existing_user() IS 'Intentionally a no-op. Reconciliation handled by link_requests_to_new_user trigger on auth.users INSERT.';