# Fix: weekly "What's New" broadcast stopped sending

## What actually broke (verified)

The weekly digest is not a webhook or a changelog page. It is a scheduled job that runs every Friday at 16:00 UTC and calls the `send-weekly-digest` function, which reads the last 7 days of commits, rewrites them with AI, and sends a Resend broadcast to the audience.

Verified findings:

- The schedule itself is alive and fires: every Friday run, including today 2026-08-14 16:00 UTC, is recorded as `succeeded` (that only means the HTTP post was made, not that the email went out).
- The security hardening pass added a shared-secret gate to `send-weekly-digest`: it requires the header `x-internal-secret` to match `CRON_SECRET`, otherwise it returns 401 before doing any work.
- The scheduled command was never updated. It sends only `Content-Type` and `Authorization`. No `x-internal-secret`. So every run since the hardening is rejected with 401 and no broadcast is created.
- Zero rows of type `release_notes` or digest have ever been logged in `email_events`, so there is no delivery record to contradict this.

Same header mismatch affects three other scheduled jobs, which explains other silent stoppages:

- `send-collab-reminder` (daily 09:00)
- `send-collab-retrospective` (daily 14:00) — last retrospective email in the database is 2026-07-09
- `fetch-collab-metrics` (4 jobs: hourly, 06:00, 07:00, 08:00) — collab metrics snapshots stopped

Not the cause: Resend keys, RLS on user tables, or the recipient query. The digest sends to a Resend audience, not a database query, and other transactional email (`new_message`) sent successfully today.

## Fix

1. Rewrite all seven scheduled commands to include the `x-internal-secret` header, reading `CRON_SECRET` from the vault at run time instead of hardcoding it. Keep names and schedules unchanged.
2. Add a delivery record: `send-weekly-digest` writes one row per run into `email_events` with type `weekly_digest` and status `sent`, `skipped` (fewer than 2 meaningful commits), or `failed` plus the error text. Same for the reminder and retrospective runs so a silent stop is visible in data next time.
3. Add an admin-only manual trigger so the digest never depends solely on cron: a "Send weekly digest" action on the admin analytics page with a preview of the generated subject and bullets before sending. Sends require an admin role check inside the function, in addition to the cron secret path.
4. Run the digest once manually after the fix so this week's update goes out.

## Technical notes

- Migration unschedules and reschedules jobs 1 through 7 via `cron.schedule`, building the headers JSON with the decrypted `CRON_SECRET` from `vault.decrypted_secrets`, the same pattern already used by `notify_new_collab_request`.
- `send-weekly-digest` gains a second accepted auth path: valid `x-internal-secret`, or a caller JWT that passes `has_role(auth.uid(), 'admin')`. A `previewOnly` flag returns the generated subject and bullets without creating the Resend broadcast.
- Logging uses the existing `email_events` table with the service-role client, `request_id` set to a generated UUID for broadcast rows.
- No changes to RLS, the creators table, or the recipient audience.
