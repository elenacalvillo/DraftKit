// Regression tests: stripe-webhook must reject unsigned / invalid-signature
// requests. We hit the deployed function over HTTP — no local server boot.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

Deno.test("stripe-webhook rejects request with no signature header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "customer.subscription.created", data: {} }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Invalid webhook signature");
});

Deno.test("stripe-webhook rejects request with bogus signature", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "t=1,v1=deadbeef",
    },
    body: JSON.stringify({ type: "customer.subscription.created", data: {} }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Invalid webhook signature");
});

Deno.test("stripe-webhook rejects empty body with no signature", async () => {
  const res = await fetch(FN_URL, { method: "POST", body: "" });
  await res.text();
  assertEquals(res.status, 400);
});
