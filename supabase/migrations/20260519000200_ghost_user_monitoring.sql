-- =============================================================
-- Ghost-user monitoring (Ticket: monitor-ghost-users).
--
-- A small piece of state used by the `monitor-ghost-users` edge
-- function to (a) deduplicate alerts so the admin is not paged
-- once per hour for the same unresolved gap and (b) reset the
-- alert when the gap drops back below the threshold.
--
-- The accompanying pg_cron job pings the edge function every
-- hour. `pg_cron` is already enabled in the Supabase dashboard
-- for this project; this migration is a no-op if it isn't, which
-- keeps local migrations runnable without manual setup.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.ghost_user_alert_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- singleton
  last_alert_gap integer NOT NULL DEFAULT 0,
  last_alert_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ghost_user_alert_state (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ghost_user_alert_state ENABLE ROW LEVEL SECURITY;
-- No policies — service_role only (the monitor edge function).

-- =============================================================
-- pg_cron schedule
--
-- pg_cron + pg_net are enabled on this Supabase project. If
-- either extension is unavailable in a local/dev environment we
-- skip the schedule registration entirely so migrations still
-- apply cleanly elsewhere.
-- =============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
  THEN
    -- Drop any prior schedule with the same name so re-running
    -- the migration is idempotent.
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'monitor-ghost-users-hourly';

    PERFORM cron.schedule(
      'monitor-ghost-users-hourly',
      '0 * * * *',
      $job$
      SELECT net.http_post(
        url := current_setting('app.supabase_url', true)
               || '/functions/v1/monitor-ghost-users',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer '
            || current_setting('app.supabase_service_role_key', true)
        ),
        body := '{}'::jsonb
      ) AS request_id;
      $job$
    );
  END IF;
END $$;
