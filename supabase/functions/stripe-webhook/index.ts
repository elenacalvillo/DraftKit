// Edge function: stripe-webhook
//
// Handles `customer.subscription.*` events from Stripe and updates
// `creators.subscription_tier` accordingly.
//
//   * If the subscribed price ID matches PROJECT_TIER_PRICE_ID, the
//     creator is upgraded to the 'project' tier.
//   * Any other recurring subscription falls back to 'pro'.
//   * Cancellation / past_due downgrades the creator to 'free' and
//     clears `stripe_subscription_id`. Existing projects remain
//     intact (read-only handling is enforced at the app layer).
//
// One-time credit purchases use a different webhook event type
// (`checkout.session.completed`) and are handled in fulfill-credits.
// We intentionally do not process them here.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const liveKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "";
  const liveWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const testWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "";
  const projectPriceLive = Deno.env.get("PROJECT_TIER_PRICE_ID") ?? "price_1TSknqAgAh00fVW1Opx4dfq7";
  const projectPriceTest = "price_1TSnOsAgAh00fVW1HkJerNQo";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const sig = req.headers.get("stripe-signature") ?? "";
    const payload = await req.text();

    // Try live secret first, then test. Whichever verifies wins.
    let event: Stripe.Event | null = null;
    let isTestEvent = false;
    if (liveWebhookSecret) {
      try {
        const tmp = new Stripe(liveKey, { apiVersion: "2025-08-27.basil" });
        event = await tmp.webhooks.constructEventAsync(payload, sig, liveWebhookSecret);
      } catch { /* try test */ }
    }
    if (!event && testWebhookSecret) {
      try {
        const tmp = new Stripe(testKey || liveKey, { apiVersion: "2025-08-27.basil" });
        event = await tmp.webhooks.constructEventAsync(payload, sig, testWebhookSecret);
        isTestEvent = true;
      } catch { /* fall through */ }
    }
    if (!event) {
      // Dev fallback when no secret is configured at all.
      if (!liveWebhookSecret && !testWebhookSecret) {
        event = JSON.parse(payload) as Stripe.Event;
        isTestEvent = event.livemode === false;
      } else {
        throw new Error("Invalid webhook signature");
      }
    }
    if (event.livemode === false) isTestEvent = true;

    const projectPriceId = isTestEvent ? projectPriceTest : projectPriceLive;

    // Only handle the subscription lifecycle here. Everything else
    // (one-time purchases, etc.) goes through fulfill-credits or
    // dedicated handlers.
    if (
      !event.type.startsWith("customer.subscription.") &&
      event.type !== "checkout.session.completed"
    ) {
      return new Response(JSON.stringify({ ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: look up the creator row by Stripe customer ID.
    async function findCreatorByCustomer(customerId: string) {
      const { data } = await supabase
        .from("creators")
        .select("id, user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      return data;
    }

    if (event.type === "checkout.session.completed") {
      // Subscription checkout completion — link the customer to the
      // creator on first checkout. Skip for one-time payment mode.
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") {
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = session.metadata?.user_id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      if (userId && customerId) {
        await supabase
          .from("creators")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId);
      }
      // Server-side analytics: record checkout completion redundantly
      try {
        await supabase.from("analytics_events").insert({
          event_type: "checkout_completed",
          user_id: userId ?? null,
          event_data: {
            source: "stripe_webhook",
            mode: session.mode,
            amount_total: session.amount_total,
            currency: session.currency,
            stripe_session_id: session.id,
            tier_hint: session.metadata?.tier ?? null,
            test: isTestEvent,
          },
        });
      } catch (_) { /* non-fatal */ }
      return new Response(JSON.stringify({ linked: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // customer.subscription.{created,updated,deleted}
    const sub = event.data.object as Stripe.Subscription;
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const creator = await findCreatorByCustomer(customerId);
    if (!creator) {
      // No matching creator — drop silently. We don't fail the
      // webhook (Stripe would retry indefinitely).
      return new Response(JSON.stringify({ noCreator: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCancelledOrPastDue =
      event.type === "customer.subscription.deleted" ||
      sub.status === "canceled" ||
      sub.status === "incomplete_expired" ||
      sub.status === "past_due" ||
      sub.status === "unpaid";

    if (isCancelledOrPastDue) {
      await supabase
        .from("creators")
        .update({
          subscription_tier: "free",
          stripe_subscription_id: null,
        })
        .eq("id", creator.id);
      return new Response(JSON.stringify({ downgraded: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine tier from the active subscription price. The
    // project price ID is configured via env var so it can change
    // without a code release.
    const priceId =
      sub.items?.data?.[0]?.price?.id ?? (sub.items?.data?.[0]?.price as { id?: string } | undefined)?.id ?? null;
    const tier = priceId && projectPriceId && priceId === projectPriceId ? "project" : "pro";

    await supabase
      .from("creators")
      .update({
        subscription_tier: tier,
        stripe_subscription_id: sub.id,
      })
      .eq("id", creator.id);

    // Server-side analytics: record subscription activation redundantly
    try {
      if (event.type === "customer.subscription.created") {
        await supabase.from("analytics_events").insert({
          event_type: "checkout_completed",
          user_id: creator.user_id ?? null,
          event_data: {
            source: "stripe_webhook_sub_created",
            tier,
            price_id: priceId,
            subscription_id: sub.id,
            test: isTestEvent,
          },
        });
      }
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ tier }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
