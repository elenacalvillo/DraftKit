
-- 1. Dedup table for recovery emails (referenced by the edge function).
CREATE TABLE IF NOT EXISTS public.recovery_emails_sent (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_emails_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view recovery sends" ON public.recovery_emails_sent;
CREATE POLICY "Admins can view recovery sends"
ON public.recovery_emails_sent
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. One-shot cron: fire ~5 min after apply, then unschedule itself.
DO $bootstrap$
DECLARE
  fire_at timestamptz := now() + interval '5 minutes';
  cron_expr text := to_char(fire_at at time zone 'UTC', 'MI HH24 DD MM *');
BEGIN
  -- Drop any prior attempt so we always have a fresh schedule.
  PERFORM cron.unschedule('ghost-recovery-bigsend-oneshot')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ghost-recovery-bigsend-oneshot');

  PERFORM cron.schedule(
    'ghost-recovery-bigsend-oneshot',
    cron_expr,
    $job$
    DO $body$
    DECLARE
      service_key text;
    BEGIN
      SELECT decrypted_secret INTO service_key
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
        LIMIT 1;

      PERFORM net.http_post(
        url := 'https://cbgchxesngdsvkevbqwh.supabase.co/functions/v1/send-ghost-user-recovery',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := '{}'::jsonb
      );

      PERFORM cron.unschedule('ghost-recovery-bigsend-oneshot');
    END
    $body$;
    $job$
  );
END
$bootstrap$;
