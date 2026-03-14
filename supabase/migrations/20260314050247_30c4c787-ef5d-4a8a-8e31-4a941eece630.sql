
CREATE OR REPLACE FUNCTION public.sync_creator_to_resend()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url text := 'https://cbgchxesngdsvkevbqwh.supabase.co';
  service_key text;
  creator_row record;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  SELECT name INTO creator_row
  FROM creators WHERE id = NEW.creator_id;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/sync-to-resend',
    body := jsonb_build_object(
      'email', NEW.email,
      'full_name', creator_row.name
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_creator_to_resend
  AFTER INSERT ON public.creator_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_creator_to_resend();
