import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_AUDIENCE_ID = "84fa3259-a54a-4c06-9493-e0bd9d720fd0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { email, full_name } = await req.json();
    if (!email) {
      throw new Error("email is required");
    }

    // Split full name at first space to get just the first name
    const firstName = full_name ? full_name.split(" ")[0] : undefined;

    // POST to Resend Audiences API
    // Omitting `unsubscribed` field so Resend preserves existing unsubscribe status
    const body: Record<string, string> = { email };
    if (firstName) {
      body.first_name = firstName;
    }

    const response = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Resend API error [${response.status}]: ${JSON.stringify(data)}`
      );
    }

    console.log("Synced contact to Resend:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-to-resend error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
