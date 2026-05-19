-- One-shot trigger for the "Big Send" ghost user recovery.
-- Fires ~5 minutes after this migration applies, calls the
-- send-ghost-user-recovery edge function exactly once, then
-- unschedules itself so it never runs again.
DO $$
DECLARE
  fire_at timestamptz := now() + interval '5 minutes';
  cron_expr text;
BEGIN
  -- Build a cron expression pinned to the exact minute/hour/day/month
  -- of fire_at. pg_cron evaluates in UTC.
  cron_expr := to_char(fire_at at time zone 'UTC',
    'FMMI FMHH24 FMDD FMMM') || ' *';

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
        body := '{"trigger":"bigsend_oneshot"}'::jsonb
      );

      -- Self-destruct so this never fires again.
      PERFORM cron.unschedule('ghost-recovery-bigsend-oneshot');
    END
    $body$;
    $job$
  );
END;
$$;
