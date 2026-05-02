// Edge function: check-subscription
//
// Reconciles the authenticated user's `creators.subscription_tier` from
// the live Stripe API. Acts as a safety net when the Stripe webhook is
// delayed, missing, or hasn't been wired yet — the success page polls
// this until tier flips off 'free'.
//
// Returns:
//   { tier: 'free' | 'pro' | 'project',
//     subscriptionId: string | null,
//     customerId: string | null }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRO_PRICE_IDS = new Set([
  "price_1Szs8CAgAh00fVW11BjTnSrF", // pro monthly
  "price_1TJRLwAgAh00fVW16vp9a32v", // pro yearly
]);

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
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(
      token,
    );
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2025-08-27.basil",
    });
    const projectPriceId = Deno.env.get("PROJECT_TIER_PRICE_ID") ?? "";

    // Resolve the Stripe customer by email (mirrors create-checkout).
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ tier: "free", subscriptionId: null, customerId: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const customerId = customers.data[0].id;

    // Find an active subscription
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subs.data.length === 0) {
      // Downgrade locally too
      await admin
        .from("creators")
        .update({
          subscription_tier: "free",
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
        })
        .eq("user_id", user.id);
      return new Response(
        JSON.stringify({
          tier: "free",
          subscriptionId: null,
          customerId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sub = subs.data[0];
    const priceId = sub.items.data[0]?.price?.id ?? null;
    let tier: "pro" | "project" = "pro";
    if (projectPriceId && priceId === projectPriceId) tier = "project";
    else if (priceId && PRO_PRICE_IDS.has(priceId)) tier = "pro";

    await admin
      .from("creators")
      .update({
        subscription_tier: tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        tier,
        subscriptionId: sub.id,
        customerId,
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
