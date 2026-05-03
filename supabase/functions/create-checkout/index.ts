import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Production hosts that should hit LIVE Stripe.
const LIVE_HOSTS = new Set(["draftkit.app", "www.draftkit.app", "collabstack.lovable.app"]);

function isTestModeFromOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return !LIVE_HOSTS.has(host);
  } catch {
    return false;
  }
}

const LIVE_PRICES = {
  pro_monthly: "price_1Szs8CAgAh00fVW11BjTnSrF",
  pro_yearly: "price_1TJRLwAgAh00fVW16vp9a32v",
} as const;

const TEST_PRICES = {
  project: "price_1TSnOsAgAh00fVW1HkJerNQo",
  pro_monthly: "price_1TSnOtAgAh00fVW1ONn6cIFj",
  pro_yearly: "price_1TSnOvAgAh00fVW1QUnVDv8i",
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId, returnTo, plan } = await req.json();

    const origin = req.headers.get("origin") || "https://collabstack.lovable.app";
    const testMode = isTestModeFromOrigin(origin);

    const stripeKey = testMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    let resolvedPriceId: string | undefined;
    if (plan === "project") {
      resolvedPriceId = testMode
        ? TEST_PRICES.project
        : (Deno.env.get("PROJECT_TIER_PRICE_ID") ?? undefined);
    } else if (plan === "pro_monthly") {
      resolvedPriceId = testMode ? TEST_PRICES.pro_monthly : LIVE_PRICES.pro_monthly;
    } else if (plan === "pro_yearly") {
      resolvedPriceId = testMode ? TEST_PRICES.pro_yearly : LIVE_PRICES.pro_yearly;
    } else if (typeof priceId === "string" && priceId.trim()) {
      resolvedPriceId = priceId.trim();
    }

    if (!resolvedPriceId) throw new Error("priceId is required");

    function isValidReturnPath(path: unknown): path is string {
      if (typeof path !== "string" || !path) return false;
      if (!path.startsWith("/")) return false;
      if (path.includes("..")) return false;
      if (path.includes(":") || path.includes("//")) return false;
      if (path.length > 200) return false;
      return true;
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const successUrl = isValidReturnPath(returnTo)
      ? `${origin}${returnTo}?pro_activated=true`
      : `${origin}/dashboard/subscription?success=true`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      mode: "subscription",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: `${origin}/dashboard/subscription?canceled=true`,
      metadata: { user_id: user.id, plan: plan ?? "pro", mode: testMode ? "test" : "live" },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cannot combine currencies")) {
        session = await stripe.checkout.sessions.create({
          ...sessionParams,
          customer_email: user.email,
        });
      } else {
        throw err;
      }
    }

    return new Response(JSON.stringify({ url: session.url, mode: testMode ? "test" : "live" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
