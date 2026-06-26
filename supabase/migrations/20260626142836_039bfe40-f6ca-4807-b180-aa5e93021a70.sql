DO $$
DECLARE
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  PERFORM net.http_post(
    url := 'https://cbgchxesngdsvkevbqwh.supabase.co/functions/v1/send-signup-fix-followup',
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(
        'c13c8a94-412c-49d2-af8f-6e8e4a611f3d',
        'e86dd784-e32d-46ac-b256-e42fd16562f3',
        '7f55bd22-d327-4d30-9bc9-7541b05a960d',
        'c1e0319b-767d-4cfd-bb26-979123e14eab'
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );
END $$;