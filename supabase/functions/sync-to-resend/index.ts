import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // Auth gate: function is invoked either from a Postgres trigger with
    // the service-role key, or by an authenticated user syncing their OWN
    // email. Anyone else is blocked to prevent strangers from enrolling
    // arbitrary addresses into the Resend audience.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
    if (!bearer) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isServiceRole = bearer === SERVICE_ROLE_KEY;
    let callerEmail: string | null = null;
    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data, error } = await userClient.auth.getUser(bearer);
      if (error || !data?.user?.email) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerEmail = data.user.email.toLowerCase();
    }

    const { email, full_name } = await req.json();
    if (!email) {
      throw new Error("email is required");
    }

    // Non-service callers can only sync their own email address.
    if (!isServiceRole && callerEmail !== String(email).toLowerCase()) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
