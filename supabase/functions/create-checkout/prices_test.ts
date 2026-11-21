import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { resolvePlan, resolvePriceId } from "./prices.ts";

Deno.test("rejects a price the server doesn't sell", () => {
  assertEquals(resolvePlan(undefined, "price_attacker_cheap"), undefined);
});

Deno.test("unknown plan names are rejected", () => {
  assertEquals(resolvePlan("free_forever", undefined), undefined);
});

Deno.test("monthly Pro price maps to the live monthly price", () => {
  const plan = resolvePlan(undefined, "price_1Szs8CAgAh00fVW11BjTnSrF");
  assertEquals(plan, "pro_monthly");
  assertEquals(resolvePriceId(plan!, false, undefined), "price_1Szs8CAgAh00fVW11BjTnSrF");
});

Deno.test("yearly Pro price maps to the live yearly price", () => {
  const plan = resolvePlan(undefined, "price_1TJRLwAgAh00fVW16vp9a32v");
  assertEquals(resolvePriceId(plan!, false, undefined), "price_1TJRLwAgAh00fVW16vp9a32v");
});

Deno.test("project plan uses the server-configured price", () => {
  assertEquals(resolvePriceId("project", false, "price_project_live"), "price_project_live");
});
