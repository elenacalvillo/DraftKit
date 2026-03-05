
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_new_collab_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://cbgchxesngdsvkevbqwh.supabase.co';
  service_key text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-collab-email',
      body := jsonb_build_object(
        'type', 'request_received',
        'requestId', NEW.id::text
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_collab_request
  AFTER INSERT ON public.collab_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_collab_request();
