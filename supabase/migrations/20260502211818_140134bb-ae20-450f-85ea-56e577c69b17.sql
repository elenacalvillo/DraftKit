
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_storage_used(
  _creator_id uuid,
  _delta_bytes bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  owner_uid uuid;
  current_used bigint;
  cap bigint := 1073741824; -- 1 GB
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, storage_used_bytes INTO owner_uid, current_used
  FROM public.creators WHERE id = _creator_id;

  IF owner_uid IS NULL OR owner_uid <> uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _delta_bytes > 0 AND current_used + _delta_bytes > cap THEN
    RAISE EXCEPTION 'Storage cap exceeded';
  END IF;

  UPDATE public.creators
  SET storage_used_bytes = GREATEST(0, storage_used_bytes + _delta_bytes)
  WHERE id = _creator_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_storage_used(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_storage_used(uuid, bigint) TO authenticated;
