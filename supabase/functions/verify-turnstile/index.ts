/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 1. Get the Secret Key and the Bypass Flag
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");
const BYPASS_ENABLED = Deno.env.get("TURNSTILE_BYPASS_ENABLED") === "true";

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 2. THE CIRCUIT BREAKER: If bypass is on, we stop here and say "YES"
    if (BYPASS_ENABLED) {
      console.warn("[verify-turnstile] Security bypassed via Kill Switch");
      return new Response(JSON.stringify({ success: true, bypassed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Normal check: If no bypass, make sure we actually have a key
    if (!TURNSTILE_SECRET_KEY) {
      console.error("[verify-turnstile] TURNSTILE_SECRET_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Turnstile secret key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";

    // 4. Verify with Cloudflare
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: clientIp,
      }),
    });

    const result: TurnstileVerifyResponse = await verifyResponse.json();

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          challenge_ts: result.challenge_ts,
          hostname: result.hostname,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      console.error("Turnstile verification failed:", result["error-codes"]);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verification failed",
          codes: result["error-codes"],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
