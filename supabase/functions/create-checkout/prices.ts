// Server-owned price list. Callers pick a plan; they never supply a price.
export const LIVE_PRICES = {
  pro_monthly: "price_1Szs8CAgAh00fVW11BjTnSrF",
  pro_yearly: "price_1TJRLwAgAh00fVW16vp9a32v",
} as const;

export const TEST_PRICES = {
  project: "price_1TSnOsAgAh00fVW1HkJerNQo",
  pro_monthly: "price_1TSnOtAgAh00fVW1ONn6cIFj",
  pro_yearly: "price_1TSnOvAgAh00fVW1QUnVDv8i",
} as const;

export type Plan = "project" | "pro_monthly" | "pro_yearly";

// Older clients send a known price ID instead of a plan name.
const KNOWN_PRICE_TO_PLAN: Record<string, Plan> = {
  [LIVE_PRICES.pro_monthly]: "pro_monthly",
  [LIVE_PRICES.pro_yearly]: "pro_yearly",
  [TEST_PRICES.pro_monthly]: "pro_monthly",
  [TEST_PRICES.pro_yearly]: "pro_yearly",
};

export function resolvePlan(plan: unknown, priceId: unknown): Plan | undefined {
  if (plan === "project" || plan === "pro_monthly" || plan === "pro_yearly") return plan;
  if (typeof priceId === "string") return KNOWN_PRICE_TO_PLAN[priceId.trim()];
  return undefined;
}

export function resolvePriceId(
  plan: Plan,
  testMode: boolean,
  liveProjectPriceId: string | undefined,
): string | undefined {
  if (plan === "project") return testMode ? TEST_PRICES.project : liveProjectPriceId;
  return testMode ? TEST_PRICES[plan] : LIVE_PRICES[plan];
}
