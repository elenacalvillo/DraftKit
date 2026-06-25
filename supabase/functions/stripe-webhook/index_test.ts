// Regression tests: stripe-webhook must never process a request without
// a valid Stripe signature. We hit the deployed function over HTTP.
//
// The handler can reject with either:
//   * 400 "Invalid webhook signature" — secret configured, sig didn't verify
//   * 500 "Webhook secret not configured" — fail-closed when no secret env var
// Both outcomes prove the previous "process unsigned JSON if no secret" path
// is gone. The tests assert neither call returns a 2xx success.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

const assertRejected = (status: number, body: { error?: string }) => {
  assert(
    status === 400 || status === 500,
    `expected 400 or 500, got ${status} ${JSON.stringify(body)}`,
  );
  assert(
    body.error === "Invalid webhook signature" ||
      body.error === "Webhook secret not configured",
    `unexpected error body: ${JSON.stringify(body)}`,
  );
};

Deno.test("stripe-webhook rejects request with no signature header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "customer.subscription.created", data: {} }),
  });
  const body = await res.json();
  assertRejected(res.status, body);
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
  assertRejected(res.status, body);
});

Deno.test("stripe-webhook rejects empty body with no signature", async () => {
  const res = await fetch(FN_URL, { method: "POST", body: "" });
  const body = await res.json();
  assertRejected(res.status, body);
});
