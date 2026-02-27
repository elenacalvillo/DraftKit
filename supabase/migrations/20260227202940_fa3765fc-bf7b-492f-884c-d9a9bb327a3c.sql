CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only auto-link if the caller is authenticated AND requester_user_id is not already set
  -- When auth.uid() IS NULL (anonymous guest), skip entirely to avoid RLS violations
  IF NEW.requester_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT c.user_id INTO NEW.requester_user_id
    FROM public.creators c
    JOIN public.creator_contacts cc
      ON cc.creator_id = c.id
    WHERE cc.email = NEW.requester_email
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$function$;