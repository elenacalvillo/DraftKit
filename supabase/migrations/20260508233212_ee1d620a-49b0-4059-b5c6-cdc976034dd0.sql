
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS last_nudge_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_inactive_credit_users()
RETURNS TABLE (
  user_id uuid,
  creator_id uuid,
  name text,
  email text,
  credits integer,
  nudge_count integer,
  last_nudge_sent_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.user_id,
    c.id,
    c.name,
    u.email::text,
    c.credits,
    c.nudge_count,
    c.last_nudge_sent_at,
    u.last_sign_in_at
  FROM public.creators c
  JOIN auth.users u ON u.id = c.user_id
  WHERE c.credits > 0
    AND c.nudge_count < 3
    AND (u.last_sign_in_at IS NULL OR u.last_sign_in_at < now() - interval '7 days')
  ORDER BY u.last_sign_in_at ASC NULLS FIRST;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_nudge_count(_creator_id uuid)
RETURNS TABLE (nudge_count integer, last_nudge_sent_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_last timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT c.last_nudge_sent_at INTO current_last
  FROM public.creators c WHERE c.id = _creator_id;

  IF current_last IS NOT NULL AND current_last > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Nudge already sent within the last 24 hours';
  END IF;

  UPDATE public.creators
  SET nudge_count = nudge_count + 1,
      last_nudge_sent_at = now()
  WHERE id = _creator_id;

  RETURN QUERY
  SELECT c.nudge_count, c.last_nudge_sent_at
  FROM public.creators c WHERE c.id = _creator_id;
END;
$$;
