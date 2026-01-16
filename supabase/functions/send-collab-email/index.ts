import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Dynamic import for Resend to avoid npm: specifier issues
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CollabStack <onboarding@resend.dev>",
      reply_to: "hello@elenacalvillo.com",
      to,
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  return await response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "request_approved" | "request_declined" | "request_received";
  requestId: string;
}

interface CollabDraft {
  title: string;
  hook: string;
  outline: Array<{
    section: string;
    contributor: string;
    description: string;
  }>;
  talkingPoints: string[];
  suggestedFormat: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, requestId }: EmailRequest = await req.json();

    if (!type || !requestId) {
      return new Response(
        JSON.stringify({ error: "Missing type or requestId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the request with creator info
    const { data: request, error: requestError } = await supabase
      .from("collab_requests")
      .select(`
        *,
        creators (
          name,
          username,
          email,
          collab_style,
          collab_guidelines,
          newsletter_url
        )
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("Request fetch error:", requestError);
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creatorName = request.creators?.name || "Creator";
    const creatorEmail = request.creators?.email;
    const creatorUsername = request.creators?.username;
    const requesterName = request.requester_name;
    const requesterEmail = request.requester_email;
    const requestedDate = request.requested_date;
    const collabStyle = request.creators?.collab_style || "Virtual Coffee";
    const collabGuidelines = request.creators?.collab_guidelines;
    const aiDraft = request.ai_draft as CollabDraft | null;

    // Format the requested date nicely
    const formattedDate = requestedDate 
      ? new Date(requestedDate).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long", 
          day: "numeric",
          year: "numeric"
        })
      : "Flexible date";

    // Build the booking page URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://collabstack.lovable.app";
    const bookingUrl = `${baseUrl}/${creatorUsername}`;

    let emailSubject = "";
    let emailHtml = "";
    let toEmail = "";

    if (type === "request_approved") {
      toEmail = requesterEmail;
      emailSubject = `🎉 ${creatorName} approved your collaboration request!`;
      
      // Build AI draft section if available
      let draftSection = "";
      if (aiDraft) {
        draftSection = `
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #8b5cf6;">
            <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px;">✨ AI-Generated Collaboration Draft</h3>
            <p style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #8b5cf6;">${aiDraft.title}</p>
            <p style="margin: 0 0 16px 0; color: #475569; font-style: italic;">${aiDraft.hook}</p>
            
            <p style="margin: 16px 0 8px 0; font-weight: 600; color: #1e293b;">Suggested Format:</p>
            <p style="margin: 0 0 16px 0; color: #475569;">${aiDraft.suggestedFormat}</p>
            
            <p style="margin: 16px 0 8px 0; font-weight: 600; color: #1e293b;">Key Talking Points:</p>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
              ${aiDraft.talkingPoints.slice(0, 4).map(point => `<li style="margin-bottom: 8px;">${point}</li>`).join("")}
            </ul>
          </div>
        `;
      }

      // Build playbook section
      let playbookSection = "";
      if (collabGuidelines) {
        playbookSection = `
          <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px;">📋 ${creatorName}'s Collaboration Playbook</h3>
            <p style="margin: 0 0 8px 0; color: #78350f;"><strong>Style:</strong> ${collabStyle}</p>
            <p style="margin: 0; color: #78350f; white-space: pre-line;">${collabGuidelines}</p>
          </div>
        `;
      }

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #d946ef); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="color: white; font-size: 24px;">✨</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">Collaboration Approved!</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterName},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Great news! <strong>${creatorName}</strong> has approved your collaboration request${requestedDate ? ` for <strong>${formattedDate}</strong>` : ""}.
          </p>

          ${draftSection}
          
          ${playbookSection}

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Ready to get started?</p>
            <a href="mailto:${creatorEmail}?subject=Re: Collaboration on ${formattedDate}" 
               style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Reply to ${creatorName}
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The CollabStack Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "request_declined") {
      toEmail = requesterEmail;
      emailSubject = `Update on your collaboration request with ${creatorName}`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 48px; height: 48px; background: #f1f5f9; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="font-size: 24px;">📬</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">Request Update</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterName},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Thank you for reaching out to <strong>${creatorName}</strong> for a collaboration. Unfortunately, they're unable to proceed with this request at this time.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            This doesn't mean the door is closed forever—schedules change, and there may be opportunities in the future. Keep creating great content!
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Looking for other collaborators?</p>
            <a href="${baseUrl}" 
               style="display: inline-block; background: #475569; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Discover More Creators
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Best of luck,<br>
            The CollabStack Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "request_received") {
      // Email to host when they receive a new request
      toEmail = creatorEmail;
      emailSubject = `🔔 New collaboration request from ${requesterName}`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #d946ef); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="color: white; font-size: 24px;">📨</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">New Collaboration Request</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${creatorName},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${requesterName}</strong> wants to collaborate with you${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}!
          </p>

          ${request.message ? `
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #8b5cf6;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Their message:</p>
            <p style="margin: 0; color: #1e293b; white-space: pre-line;">${request.message}</p>
          </div>
          ` : ""}

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="${baseUrl}/dashboard/requests" 
               style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Request
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The CollabStack Team
          </p>
        </body>
        </html>
      `;
    }

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: "No recipient email found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send the email
    const emailResponse = await sendEmail([toEmail], emailSubject, emailHtml);

    console.log(`Email sent successfully (${type}):`, emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-collab-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
