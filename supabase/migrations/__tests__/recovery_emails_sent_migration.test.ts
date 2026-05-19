import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "..",
  "20260519000100_recovery_emails_sent.sql",
);

const sql = readFileSync(migrationPath, "utf8");

/**
 * `recovery_emails_sent` — dedup log for the ghost-user recovery
 * edge function. We pin:
 *
 *   - user_id is the PRIMARY KEY, so an INSERT ... ON CONFLICT
 *     DO NOTHING is enough to guarantee at-most-once delivery
 *     even if the function runs concurrently.
 *   - The PK references auth.users with ON DELETE CASCADE so a
 *     user deletion doesn't leave a tombstone behind.
 *   - RLS is on with no policies — only service_role (which
 *     bypasses RLS) can read or write.
 */
describe("recovery_emails_sent migration", () => {
  it("creates the table with user_id as PRIMARY KEY referencing auth.users with CASCADE", () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.recovery_emails_sent/,
    );
    expect(sql).toMatch(
      /user_id uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it("stores the email and a sent_at timestamp that defaults to now()", () => {
    expect(sql).toMatch(/email text NOT NULL/);
    expect(sql).toMatch(/sent_at timestamptz NOT NULL DEFAULT now\(\)/);
  });

  it("indexes sent_at for time-bounded queries", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS recovery_emails_sent_sent_at_idx[\s\S]*\(sent_at DESC\)/,
    );
  });

  it("enables RLS and intentionally declares NO policies (service_role only)", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.recovery_emails_sent ENABLE ROW LEVEL SECURITY/,
    );
    // No CREATE POLICY anywhere — service_role bypasses RLS, and
    // we explicitly do not want anon/authenticated to read or
    // write this log.
    expect(sql).not.toMatch(/CREATE POLICY/);
  });
});
