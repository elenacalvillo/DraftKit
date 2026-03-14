import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all creator contacts joined with creator names
    const { data: contacts, error } = await supabase
      .from("creator_contacts")
      .select("email, creators!creator_contacts_creator_id_fkey(name)");

    if (error) throw new Error(`DB query failed: ${error.message}`);
    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No contacts found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      const email = contact.email;
      const fullName = (contact as any).creators?.name;
      const firstName = fullName ? fullName.split(" ")[0] : undefined;

      const body: Record<string, string> = { email };
      if (firstName) body.first_name = firstName;

      try {
        const res = await fetch(
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

        if (res.ok) {
          synced++;
        } else {
          const errData = await res.json();
          failed++;
          errors.push(`${email}: ${JSON.stringify(errData)}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${email}: ${e instanceof Error ? e.message : "unknown"}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`Backfill complete: ${synced} synced, ${failed} failed out of ${contacts.length}`);

    return new Response(
      JSON.stringify({ total: contacts.length, synced, failed, errors: errors.slice(0, 10) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("backfill-resend error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
