import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "DraftKit Notifications <notifications@draftkit.app>";

async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      reply_to: "hello@draftkit.app",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      console.warn("Resend email skipped (domain not verified):", errorText);
      return { skipped: true, reason: "RESEND_DOMAIN_NOT_VERIFIED" };
    }
    throw new Error(`Resend API error: ${errorText}`);
  }

  return await response.json();
}

function buildRetrospectiveEmail(recipientName: string, partnerName: string, collabDate: string, retroUrl: string): string {
  const starStyle = `display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;font-size:24px;text-decoration:none;margin:0 2px;border-radius:8px;`;
  const activeStarStyle = `${starStyle}background:#fffbeb;border:1px solid #fbbf24;`;
  const defaultStarStyle = `${starStyle}background:#f8fafc;border:1px solid #e2e8f0;`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
        <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">Draft</span><span style="font-size: 22px; font-weight: 700; color: #e07b6c; letter-spacing: -0.5px;">Kit</span>
        <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">The engine for creators who ship together</p>
      </div>

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0; font-size: 24px; color: #1e293b;">🎉 How Did It Go?</h1>
      </div>

      <p style="font-size: 16px; margin-bottom: 24px;">Hi ${recipientName},</p>
      
      <p style="font-size: 16px; margin-bottom: 24px;">
        Your collaboration with <strong>${partnerName}</strong> was scheduled for <strong>${collabDate}</strong>. 
        We hope it went great! 🙌
      </p>

      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; border-left: 4px solid #d9826b;">
        <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">Rate this collaboration</h3>
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">Click a star to start your 1-minute retrospective</p>
        <div>
          <a href="${retroUrl}?rating=1" style="${defaultStarStyle}">⭐</a>
          <a href="${retroUrl}?rating=2" style="${defaultStarStyle}">⭐</a>
          <a href="${retroUrl}?rating=3" style="${defaultStarStyle}">⭐</a>
          <a href="${retroUrl}?rating=4" style="${activeStarStyle}">⭐</a>
          <a href="${retroUrl}?rating=5" style="${activeStarStyle}">⭐</a>
        </div>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${retroUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Share Your Experience
        </a>
      </div>

      <div style="background: #ecfdf5; border-radius: 12px; padding: 16px 24px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46; font-size: 14px;">
          💡 <strong>Tip:</strong> Great collaborations lead to more! Consider scheduling your next one while the momentum is fresh.
        </p>
      </div>

      <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
        Congratulations on the collaboration!<br>
        The DraftKit Team
      </p>
    </body>
    </html>
  `;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting daily collaboration retrospective check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const baseUrl = Deno.env.get("SITE_URL") || "https://draftkit.app";

    // Check for manual override via request body
    let manualRequestId: string | null = null;
    try {
      const body = await req.json();
      manualRequestId = body?.request_id || null;
    } catch { /* no body */ }

    let query = supabase
      .from("collab_requests")
      .select(`
        id,
        requested_date,
        requester_name,
        requester_email,
        creators (
          name,
          creator_contacts ( email )
        )
      `);

    if (manualRequestId) {
      console.log(`Manual trigger for request: ${manualRequestId}`);
      query = query.eq("id", manualRequestId);
    } else {
      // Get today's date in YYYY-MM-DD
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      console.log(`Checking dates: ${yesterdayStr} and ${todayStr}`);
      query = query.eq("status", "approved").in("requested_date", [todayStr, yesterdayStr]);
    }

    const { data: requests, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching requests:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${requests?.length || 0} approved collabs scheduled for today`);

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No retrospectives to send", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    // Each collab gets its own retro URL now

    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    for (const request of requests) {
      const creatorName = (request.creators as any)?.name || "Creator";
      const creatorContacts = (request.creators as any)?.creator_contacts;
      const creatorEmail = Array.isArray(creatorContacts)
        ? creatorContacts[0]?.email
        : creatorContacts?.email;
      const requesterName = request.requester_name;
      const requesterEmail = request.requester_email;

      // Check deduplication for this request
      const { data: alreadySent } = await supabase
        .from("email_events")
        .select("id")
        .eq("request_id", request.id)
        .eq("type", "collab_retrospective")
        .limit(1)
        .maybeSingle();

      if (alreadySent) {
        console.log(`Retrospective already sent for request ${request.id}, skipping`);
        continue;
      }

      const retroUrl = `${baseUrl}/retro/${request.id}`;

      // Send to requester
      if (requesterEmail) {
        try {
          const html = buildRetrospectiveEmail(requesterName, creatorName, formattedDate, retroUrl);
          const result = await sendEmail([requesterEmail], `🎉 How did your collaboration with ${creatorName} go?`, html);

          await supabase.from("email_events").insert({
            request_id: request.id,
            type: "collab_retrospective",
            to_email: requesterEmail,
            provider_id: result.id || null,
            status: result.skipped ? "skipped" : "sent",
          });
          sentCount++;
        } catch (e) {
          console.error(`Failed to send retrospective to requester for ${request.id}:`, e);
        }
      }

      // Send to creator
      if (creatorEmail) {
        try {
          const html = buildRetrospectiveEmail(creatorName, requesterName, formattedDate, retroUrl);
          const result = await sendEmail([creatorEmail], `🎉 How did your collaboration with ${requesterName} go?`, html);

          await supabase.from("email_events").insert({
            request_id: request.id,
            type: "collab_retrospective",
            to_email: creatorEmail,
            provider_id: result.id || null,
            status: result.skipped ? "skipped" : "sent",
          });
          sentCount++;
        } catch (e) {
          console.error(`Failed to send retrospective to creator for ${request.id}:`, e);
        }
      }
    }

    console.log(`Retrospective check complete. Sent ${sentCount} emails.`);

    return new Response(
      JSON.stringify({ success: true, message: `Sent ${sentCount} retrospective emails`, count: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-collab-retrospective function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
