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
import { readFileSync } from "node:fs";
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
const monitorSrc = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "supabase",
    "functions",
    "monitor-ghost-users",
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

describe("monitor-ghost-users edge function", () => {
  it("applies a 1-hour grace window before counting a user as ghosted", () => {
    // Users mid-signup must not appear in the gap count — the
    // `cutoff` calculation is the hard guarantee for that.
    expect(monitorSrc).toMatch(/60 \* 60 \* 1000/);
    expect(monitorSrc).toMatch(/u\.created_at < cutoff/);
  });

  it("reads the threshold and admin email from env vars with safe defaults", () => {
    expect(monitorSrc).toMatch(/GHOST_ALERT_THRESHOLD/);
    expect(monitorSrc).toMatch(/GHOST_ALERT_EMAIL/);
  });

  it("emits the diagnostic SQL and a link to the Supabase SQL editor", () => {
    expect(monitorSrc).toMatch(
      /LEFT JOIN public\.creators c ON c\.user_id = au\.id/,
    );
    expect(monitorSrc).toMatch(/supabase\.com\/dashboard\/project/);
  });

  it("fails silently — returns 200 even when the function body errors", () => {
    // pg_cron will retry-storm if we return 5xx, and we explicitly
    // do not want this monitor to cascade alerts of its own.
    expect(monitorSrc).toMatch(/status: 200,[\s\S]*"Content-Type": "application\/json"/);
    // The catch block returns status 200, not 500.
    expect(monitorSrc).not.toMatch(/console\.error\("monitor-ghost-users error[\s\S]*status: 500/);
  });

  it("declares a pure decideAlert helper that pins the dedup contract", () => {
    expect(monitorSrc).toMatch(/export function decideAlert/);
    expect(monitorSrc).toMatch(/shouldAlert/);
    expect(monitorSrc).toMatch(/shouldReset/);
  });
});
