import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LIVE_HOSTS = new Set(["draftkit.app", "www.draftkit.app", "collabstack.lovable.app"]);

function isTestModeFromOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    return !LIVE_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const LIVE_PACKS: Record<string, { priceId: string; credits: number }> = {
  "10": { priceId: "price_1TJRKFAgAh00fVW1m8vAQsbZ", credits: 10 },
  "30": { priceId: "price_1TJRKGAgAh00fVW1KtRO3lEe", credits: 30 },
};

const TEST_PACKS: Record<string, { priceId: string; credits: number }> = {
  "10": { priceId: "price_1TSnOwAgAh00fVW18jhdH57I", credits: 10 },
  "30": { priceId: "price_1TSnOxAgAh00fVW1cmRWWFNX", credits: 30 },
};

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

    const { packId } = await req.json();

    const origin = req.headers.get("origin") || "https://collabstack.lovable.app";
    const testMode = isTestModeFromOrigin(origin);

    const pack = (testMode ? TEST_PACKS : LIVE_PACKS)[String(packId)];
    if (!pack) throw new Error("Invalid pack. Use '10' or '30'.");

    const stripeKey = testMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      const existing = customers.data[0];
      if (existing.currency && existing.currency !== "usd") {
        customerId = undefined;
      } else {
        customerId = existing.id;
      }
    }

    const sessionParams: any = {
      line_items: [{ price: pack.priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/dashboard/subscription?credits_session={CHECKOUT_SESSION_ID}&credits_amount=${pack.credits}`,
      cancel_url: `${origin}/dashboard/subscription?credits_canceled=true`,
      metadata: { user_id: user.id, credits: String(pack.credits), mode: testMode ? "test" : "live" },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
      });
    } catch (err: any) {
      if (err?.message?.includes("cannot combine currencies")) {
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
