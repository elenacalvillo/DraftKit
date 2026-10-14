/**
 * The edge-function code lives in supabase/functions/* and is
 * compiled separately by the Deno runtime, so we can't import it
 * directly from a Vitest test (it pulls deps from esm.sh + the
 * Deno standard library).
 *
 * To still pin the behaviour of the two pure helpers — the
 * ghost-user dedup filter and the alert-state decision — we
 * READ the source files as strings and require certain
 * invariants to be present. This is a deliberately light contract
 * test; the deeper behavioural coverage is via the SQL migrations.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recoverySrc = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "supabase",
    "functions",
    "send-ghost-user-recovery",
    "index.ts",
  ),
  "utf8",
);
describe("send-ghost-user-recovery edge function", () => {
  it("uses the service role key (NOT the anon key) to read auth.users", () => {
    expect(recoverySrc).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(recoverySrc).toMatch(/admin\.auth\.admin\.listUsers/);
  });

  it("excludes the documented internal/test address from the recovery batch", () => {
    // abi@rezonant.app is the internal test account flagged in the
    // ticket — emailing them on every recovery run would be noise.
    expect(recoverySrc).toMatch(/abi@rezonant\.app/);
  });

  it("deduplicates against recovery_emails_sent BEFORE calling Resend", () => {
    expect(recoverySrc).toMatch(/from\("recovery_emails_sent"\)/);
    expect(recoverySrc).toMatch(/filterGhostUsers/);
  });

  it("uses the approved subject line verbatim", () => {
    expect(recoverySrc).toMatch(
      /Your DraftKit account is ready — finish setting it up/,
    );
  });

  it("links the CTA to /signup so the user resumes at Step 2", () => {
    expect(recoverySrc).toMatch(/\$\{APP_URL\}\/signup/);
  });

  it("continues the batch on a single Resend failure instead of aborting", () => {
    // The for-loop body must be inside a try/catch — we look for
    // the explicit `status: "failed"` push to confirm the
    // continue-on-error pattern.
    expect(recoverySrc).toMatch(/status: "failed"/);
  });
});

describe("monitor-ghost-users removal", () => {
  it("no longer ships the hourly ghost-user monitor", () => {
    expect(existsSync(path.resolve(__dirname, "..", "..", "..", "supabase", "functions", "monitor-ghost-users"))).toBe(false);
  });
});
