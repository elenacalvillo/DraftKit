# Stop the hourly wake-ups that keep DraftKit's database awake

## What is actually scheduled right now (checked live)

There is no `monitor-ghost-users-hourly` job in DraftKit. It was removed earlier, so the report is describing another project (Creator Connect). The ghost-user monitor code is still in DraftKit, but nothing runs it.

DraftKit has 7 scheduled jobs:

| Job | When it runs | Runs per day |
|---|---|---|
| collab-metrics-day0 | every hour | 24 |
| collab-metrics-day1 | daily 06:00 | 1 |
| collab-metrics-day3 | daily 07:00 | 1 |
| collab-metrics-day7 | daily 08:00 | 1 |
| daily-collab-reminders | daily 09:00 | 1 |
| send-collab-retrospective-daily | daily 14:00 | 1 |
| weekly-whatsnew-digest | Fridays 16:00 | weekly |

`collab-metrics-day0` is DraftKit's only hourly job. It wakes the database 24 times a day to look for collabs published in the last hour so it can grab their first engagement numbers. That kind of steady hourly wake-up keeps the database from ever going to sleep.

## Fix

1. Remove the hourly `collab-metrics-day0` job. Take the first metrics snapshot right away when someone marks a collab Published or saves its post URL. That happens at the same moment it does now, with no polling.
2. Merge day1, day3 and day7 into one daily job at 06:00 that handles all three. That cuts 3 daily wake-ups down to 1.
3. Move reminders (09:00) and retrospectives (14:00) to 06:00 as well, so the database wakes once a day instead of at four separate times. Emails would arrive earlier in the day. Tell me if you want to keep the current times.
4. Keep the weekly digest as it is.
5. Delete the unused ghost-user monitor function so nobody reschedules it by mistake. The ghost-user recovery email remains a manual tool.

Result: 28 to 29 wake-ups a day become 1 a day plus 1 a week, and there is no hourly polling left.

## Caveat

I haven't measured whether the database actually goes to sleep or how many credits this saves. After the change I'll pull the usage report again so we can compare the days before and after.

## Technical notes

- Instant snapshot: call `fetch-collab-metrics` with `x-internal-secret` from the existing publish paths (`mark_workspace_published` RPC and post-URL save). The RPC sends it through `pg_net`, which already works this way for `notify_new_collab_request`.
- `fetch-collab-metrics` accepts a `mode: "daily"` body that runs the day1/3/7 windows in one pass. It stays idempotent per collab and day bucket.
- Reschedule through `cron.unschedule`/`cron.schedule` and read the secret from the vault, as the current jobs do.
- Remove `supabase/functions/monitor-ghost-users` and update its contract test in `ghost-user-helpers.test.ts`.
