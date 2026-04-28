import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { sessionId, credits } = await req.json();
    if (!sessionId || !credits) throw new Error("sessionId and credits are required");

    const creditsNum = parseInt(String(credits), 10);
    if (![10, 30].includes(creditsNum)) throw new Error("Invalid credits amount");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    if (session.metadata?.user_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    const metaCredits = parseInt(session.metadata?.credits || "0", 10);
    if (metaCredits !== creditsNum) {
      throw new Error("Credits mismatch");
    }

    // Idempotency: claim this Stripe session before granting credits.
    // The PRIMARY KEY on stripe_session_id makes the insert atomic — replays fail here.
    const { error: claimErr } = await supabaseAdmin
      .from("fulfilled_stripe_sessions")
      .insert({
        stripe_session_id: sessionId,
        user_id: user.id,
        credits_added: creditsNum,
      });

    if (claimErr) {
      // Unique violation = already fulfilled. Return current balance, do NOT add credits.
      const { data: existing } = await supabaseAdmin
        .from("creators")
        .select("credits")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          credits: existing?.credits ?? 0,
          alreadyFulfilled: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Increment credits using service role
    const { data: creator, error: fetchErr } = await supabaseAdmin
      .from("creators")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !creator) throw new Error("Creator profile not found");

    const newBalance = (creator.credits ?? 0) + creditsNum;

    const { error: updateErr } = await supabaseAdmin
      .from("creators")
      .update({ credits: newBalance })
      .eq("user_id", user.id);

    if (updateErr) throw new Error("Failed to update credits");

    return new Response(JSON.stringify({ credits: newBalance }), {
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
