
CREATE OR REPLACE FUNCTION public.create_creator_profile(
  _username text,
  _name text,
  _email text,
  _substack_url text DEFAULT NULL,
  _newsletter_url text DEFAULT NULL,
  _welcome_message text DEFAULT NULL,
  _join_directory_waitlist boolean DEFAULT false,
  _profile_image_url text DEFAULT NULL,
  _referred_by uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing_creator_id uuid;
  _new_creator_id uuid;
  _new_username text;
  _new_name text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF _username IS NULL OR length(trim(_username)) = 0 THEN
    RAISE EXCEPTION 'username_required' USING ERRCODE = '23514';
  END IF;

  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'email_required' USING ERRCODE = '23514';
  END IF;

  SELECT c.id INTO _existing_creator_id
  FROM public.creators c
  WHERE c.user_id = _uid;

  IF _existing_creator_id IS NOT NULL THEN
    UPDATE public.creators
       SET username = _username,
           name = _name,
           substack_url = COALESCE(_substack_url, substack_url),
           newsletter_url = COALESCE(_newsletter_url, newsletter_url),
           welcome_message = COALESCE(_welcome_message, welcome_message),
           join_directory_waitlist = _join_directory_waitlist,
           profile_image_url = COALESCE(_profile_image_url, profile_image_url),
           referred_by = COALESCE(_referred_by, referred_by),
           updated_at = now()
     WHERE id = _existing_creator_id
     RETURNING public.creators.id, public.creators.username, public.creators.name
        INTO _new_creator_id, _new_username, _new_name;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.creators c WHERE c.username = _username
    ) THEN
      RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.creators (
      user_id,
      username,
      name,
      email,
      substack_url,
      newsletter_url,
      welcome_message,
      join_directory_waitlist,
      profile_image_url,
      referred_by
    ) VALUES (
      _uid,
      _username,
      _name,
      _email,
      _substack_url,
      _newsletter_url,
      COALESCE(_welcome_message, 'Hi! I''m ' || _name || '. Let''s collaborate!'),
      _join_directory_waitlist,
      _profile_image_url,
      _referred_by
    )
    RETURNING public.creators.id, public.creators.username, public.creators.name
      INTO _new_creator_id, _new_username, _new_name;
  END IF;

  INSERT INTO public.creator_contacts (creator_id, email)
  VALUES (_new_creator_id, _email)
  ON CONFLICT (creator_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN QUERY SELECT _new_creator_id, _uid, _new_username, _new_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_creator_profile(
  text, text, text, text, text, text, boolean, text, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_creator_profile(
  text, text, text, text, text, text, boolean, text, uuid
) TO authenticated;
