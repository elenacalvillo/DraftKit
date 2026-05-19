## Goal

Ship a self-executing "Big Send" so the 18 existing ghost users receive the recovery email immediately when this change goes live — no manual broadcast, no manual POST call.

## Current state (already in place)

The `send-ghost-user-recovery` edge function already:

- Enumerates `auth.users`, subtracts `creators`, produces the ghost list
- Excludes `abi@rezonant.app`
- Dedups via `recovery_emails_sent` (each user emailed exactly once, ever)
- Sends via Resend transactional API (`/emails`)
- Uses the exact subject and body the user specified, linking to `/signup`

So the function itself is correct. The only missing piece is **automatic first-run on deployment**.

## Changes

### 1. Auto-fire on deploy via a one-shot pg_cron job

Add a migration that schedules a cron entry which:

- Runs once, ~2 minutes after the migration applies (gives the edge function time to redeploy)
- Calls `send-ghost-user-recovery` via `net.http_post` with the service-role key (read from Vault, same pattern as `notify_new_collab_request`)
- Immediately unschedules itself inside the same job so it never fires again

This is the only reliable "run on deploy" hook available — edge functions have no startup lifecycle, and we explicitly do NOT want a recurring schedule (dedup table already prevents resends, but a recurring job would be misleading).

### 2. Tighten the function for the Big Send

Small edits to `supabase/functions/send-ghost-user-recovery/index.ts`:

- Confirm the CTA link points to `/signup` (already does — keep as is)
- Confirm subject/body match the approved copy verbatim (already do — no change needed)
- No behavior change beyond a log line noting "auto-trigger" vs manual call (optional, harmless)

### 3. Verify after deploy

- Tail `supabase--edge_function_logs` for `send-ghost-user-recovery` to confirm the one-shot cron fired and the 18 sends succeeded
- Query `recovery_emails_sent` to confirm 18 rows landed (17 if `abi@rezonant.app` had somehow been in there)

### One Small Engineering Note

Since the cron is set for `now() + interval '2 minutes'`, just make sure the Edge Function deployment finishes *before* that 2-minute window closes. If the deployment is slow and the cron fires while the function is still updating, it might hit the "old" version or a 404.

> **Tip:** If you want to be extra safe, you could tell Lovable to bump that to **5 minutes**. It doesn't hurt anyone if the emails go out 3 minutes later, but it guarantees the new code is live.

## Technical detail

```sql
-- One-shot trigger: runs once ~2 min after apply, then unschedules itself
SELECT cron.schedule(
  'ghost-recovery-bigsend-oneshot',
  -- next minute boundary +2
  to_char(now() + interval '2 minutes', 'MI HH24 DD MM *'),
  $$
  DO $body$
  DECLARE
    service_key text;
  BEGIN
    SELECT decrypted_secret INTO service_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

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
  $$
);
```

The dedup table (`recovery_emails_sent`) guarantees that even if this somehow fires twice, no ghost user receives a second email.

## Out of scope

- DRAFT-001 (atomic creator profile RPC) — separate ticket
- DRAFT-003 (hourly monitor) — already implemented as `monitor-ghost-users`
- Editing the email copy — already matches the approved template