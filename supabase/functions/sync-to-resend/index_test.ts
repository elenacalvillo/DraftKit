// Regression tests: sync-to-resend must reject unauthenticated calls and
// must reject authenticated callers attempting to enroll an address that
// isn't their own. Only the service role or the owner of the email may sync.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/sync-to-resend`;

Deno.test("sync-to-resend rejects request with no Authorization header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "attacker@example.com" }),
  });
  const body = await res.json();
  // Supabase platform gateway returns 401 before the function runs when
  // verify_jwt is on; otherwise our handler returns 401. Either way the
  // call must be blocked.
  assert(res.status === 401, `expected 401, got ${res.status}`);
  assert(
    body.error === "unauthorized" || typeof body.message === "string",
    `unexpected body: ${JSON.stringify(body)}`,
  );
});

Deno.test("sync-to-resend rejects malformed Authorization header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "NotBearer abc",
    },
    body: JSON.stringify({ email: "attacker@example.com" }),
  });
  await res.json().catch(() => ({}));
  assertEquals(res.status, 401);
});

Deno.test("sync-to-resend rejects anon-key caller (not service role, no user)", async () => {
  // Anon key is a valid JWT but represents no user — getUser() must fail,
  // so the function should refuse to enroll an arbitrary email.
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email: "attacker@example.com" }),
  });
  await res.json().catch(() => ({}));
  assert(
    res.status === 401 || res.status === 403,
    `expected 401/403, got ${res.status}`,
  );
});

Deno.test("sync-to-resend rejects forged bearer token", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer not.a.real.jwt",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email: "attacker@example.com" }),
  });
  await res.json().catch(() => ({}));
  assert(
    res.status === 401 || res.status === 403,
    `expected 401/403, got ${res.status}`,
  );
});
