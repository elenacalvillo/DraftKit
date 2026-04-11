const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to verify identity
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for privileged lookups
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 2. Parse & validate body
    const { requestId, creatorId } = await req.json();
    if (!requestId || !creatorId) {
      return new Response(JSON.stringify({ error: "requestId and creatorId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verify caller owns the request
    const { data: isOwner } = await adminClient.rpc("is_request_owner", {
      _user_id: user.id,
      _request_id: requestId,
    });
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "You don't own this request" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Look up target creator's email from creator_contacts
    const { data: contact } = await adminClient
      .from("creator_contacts")
      .select("email")
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (!contact?.email) {
      return new Response(JSON.stringify({ error: "This creator hasn't set up their contact email yet" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Look up target creator's user_id
    const { data: creator } = await adminClient
      .from("creators")
      .select("user_id")
      .eq("id", creatorId)
      .maybeSingle();

    // 6. Insert into workspace_collaborators
    const { error: insertError } = await adminClient
      .from("workspace_collaborators")
      .insert({
        request_id: requestId,
        email: contact.email,
        user_id: creator?.user_id ?? null,
        invited_by: user.id,
      });

    if (insertError) {
      if (insertError.code === "23505" || insertError.message?.includes("duplicate key")) {
        return new Response(JSON.stringify({ error: "This person has already been invited" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    // 7. Deduct 1 credit if not Pro
    const { data: isPro } = await adminClient.rpc("is_pro_user", { _user_id: user.id });
    if (!isPro) {
      const { data: callerCreator } = await adminClient
        .from("creators")
        .select("credits")
        .eq("user_id", user.id)
        .maybeSingle();

      if (callerCreator && callerCreator.credits > 0) {
        await adminClient
          .from("creators")
          .update({ credits: callerCreator.credits - 1 })
          .eq("user_id", user.id);
      }
    }

    // 8. Fire invite email (fire-and-forget)
    try {
      await adminClient.functions.invoke("send-collab-email", {
        body: {
          type: "workspace_invite",
          requestId,
          inviteeEmail: contact.email,
        },
      });
    } catch {
      // fire-and-forget
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-by-profile error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
