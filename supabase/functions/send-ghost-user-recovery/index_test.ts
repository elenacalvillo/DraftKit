// Regression tests: send-ghost-user-recovery must require the
// x-internal-secret CRON shared secret. Without it, the endpoint
// would let any caller trigger a mass-email blast.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/send-ghost-user-recovery`;

Deno.test("send-ghost-user-recovery rejects request with no secret header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "unauthorized");
});

Deno.test("send-ghost-user-recovery rejects request with wrong secret", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": "definitely-not-the-real-secret",
    },
    body: "{}",
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "unauthorized");
});

Deno.test("send-ghost-user-recovery rejects empty-string secret", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "x-internal-secret": "" },
    body: "{}",
  });
  await res.json();
  assertEquals(res.status, 401);
});
