CREATE OR REPLACE FUNCTION public.get_host_capacity(_creator_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'base_limit', 3,
    'referral_bonus', (
      SELECT count(*)::int FROM referral_credits
      WHERE referrer_user_id = (SELECT user_id FROM creators WHERE id = _creator_id)
    ),
    'used', (
      SELECT count(*)::int FROM collab_requests
      WHERE creator_id = _creator_id
        AND status IN ('approved', 'published')
        AND is_project_workspace = false
    ),
    'is_pro', (
      SELECT EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = (SELECT user_id FROM creators WHERE id = _creator_id) AND role = 'pro'
      ) OR EXISTS (
        SELECT 1 FROM creators WHERE id = _creator_id AND subscription_tier = 'pro'
      ) OR EXISTS (
        SELECT 1 FROM creators WHERE id = _creator_id AND trial_ends_at > NOW())
    )
  )
$function$;