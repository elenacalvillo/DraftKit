import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "..",
  "20260519000200_ghost_user_monitoring.sql",
);

const sql = readFileSync(migrationPath, "utf8");

/**
 * Ghost-user monitoring — singleton alert state + pg_cron
 * schedule for the monitor-ghost-users edge function. We pin:
 *
 *   - The alert-state table is a true singleton (PK column with
 *     a CHECK constraint pinning it to a single row). This is
 *     what lets the edge function read/write the gap counter
 *     without ever having to query "which row is current?".
 *   - The seed row exists so the very first hourly run isn't an
 *     UPDATE-of-zero-rows.
 *   - pg_cron registration is conditional, so the migration is a
 *     no-op on environments where the extension is unavailable.
 *   - The schedule fires hourly at minute 0 (`0 * * * *`).
 *   - The cron body calls the monitor-ghost-users function and
 *     passes the service_role bearer so the edge function can
 *     access auth.users.
 */
describe("ghost_user_monitoring migration", () => {
  it("creates a singleton alert-state table seeded with one row", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.ghost_user_alert_state/);
    // Singleton enforcement — boolean PK pinned to true via CHECK.
    expect(sql).toMatch(/id boolean PRIMARY KEY DEFAULT true CHECK \(id = true\)/);
    expect(sql).toMatch(/last_alert_gap integer NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/last_alert_at timestamptz/);
    expect(sql).toMatch(
      /INSERT INTO public\.ghost_user_alert_state \(id\)\s*VALUES \(true\)\s*ON CONFLICT/,
    );
  });

  it("enables RLS on the alert-state table with no policies (service_role only)", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.ghost_user_alert_state ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]*ghost_user_alert_state/,
    );
  });

  it("registers the pg_cron schedule conditionally so the migration is portable", () => {
    // The DO $$ block must guard on pg_extension so a local
    // environment without pg_cron / pg_net still applies the
    // migration cleanly.
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\)/);
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_net'\)/);
  });

  it("schedules the monitor function hourly", () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'monitor-ghost-users-hourly',\s*'0 \* \* \* \*'/);
  });

  it("makes the schedule registration idempotent by unscheduling the previous job first", () => {
    expect(sql).toMatch(
      /cron\.unschedule\(jobid\)[\s\S]*WHERE jobname = 'monitor-ghost-users-hourly'/,
    );
  });

  it("invokes the monitor-ghost-users edge function with a service-role bearer", () => {
    expect(sql).toMatch(/\/functions\/v1\/monitor-ghost-users/);
    expect(sql).toMatch(/app\.supabase_service_role_key/);
  });
});
