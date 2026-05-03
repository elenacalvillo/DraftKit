// Edge function: check-subscription
//
// Reconciles the authenticated user's `creators.subscription_tier` from
// the Stripe API. Checks BOTH live and test mode (when test key is set)
// so preview-mode test purchases also activate the user's tier.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LIVE_PROJECT_PRICE = "price_1TSknqAgAh00fVW1Opx4dfq7";
const LIVE_PRO_PRICES = new Set([
  "price_1Szs8CAgAh00fVW11BjTnSrF",
  "price_1TJRLwAgAh00fVW16vp9a32v",
  "price_1TJRKBAgAh00fVW1XxMeveNB",
]);

const TEST_PROJECT_PRICE = "price_1TSnOsAgAh00fVW1HkJerNQo";
const TEST_PRO_PRICES = new Set([
  "price_1TSnOtAgAh00fVW1ONn6cIFj",
  "price_1TSnOvAgAh00fVW1QUnVDv8i",
]);

type Tier = "free" | "pro" | "project";

async function lookupTier(
  stripe: Stripe,
  email: string,
  projectPrice: string,
  proPrices: Set<string>,
): Promise<{ tier: Tier; customerId: string | null; subscriptionId: string | null }> {
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) return { tier: "free", customerId: null, subscriptionId: null };
  const customerId = customers.data[0].id;
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
  if (subs.data.length === 0) return { tier: "free", customerId, subscriptionId: null };
  const sub = subs.data[0];
  const priceId = sub.items.data[0]?.price?.id ?? null;
  let tier: Tier = "pro";
  if (priceId && priceId === projectPrice) tier = "project";
  else if (priceId && proPrices.has(priceId)) tier = "pro";
  return { tier, customerId, subscriptionId: sub.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const liveKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "";
    const projectPriceLive = Deno.env.get("PROJECT_TIER_PRICE_ID") || LIVE_PROJECT_PRICE;

    const results: { mode: "live" | "test"; tier: Tier; customerId: string | null; subscriptionId: string | null }[] = [];

    if (liveKey) {
      const stripe = new Stripe(liveKey, { apiVersion: "2025-08-27.basil" });
      const r = await lookupTier(stripe, user.email, projectPriceLive, LIVE_PRO_PRICES);
      results.push({ mode: "live", ...r });
    }
    if (testKey) {
      const stripe = new Stripe(testKey, { apiVersion: "2025-08-27.basil" });
      const r = await lookupTier(stripe, user.email, TEST_PROJECT_PRICE, TEST_PRO_PRICES);
      results.push({ mode: "test", ...r });
    }

    // Prefer live > test, and project > pro > free.
    const tierRank = (t: Tier) => (t === "project" ? 2 : t === "pro" ? 1 : 0);
    results.sort((a, b) => {
      const d = tierRank(b.tier) - tierRank(a.tier);
      if (d !== 0) return d;
      return a.mode === "live" ? -1 : 1;
    });
    const best = results[0] ?? { tier: "free" as Tier, customerId: null, subscriptionId: null, mode: "live" as const };

    await admin
      .from("creators")
      .update({
        subscription_tier: best.tier,
        stripe_customer_id: best.customerId,
        stripe_subscription_id: best.subscriptionId,
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        tier: best.tier,
        subscriptionId: best.subscriptionId,
        customerId: best.customerId,
        mode: best.mode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[check-subscription]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
