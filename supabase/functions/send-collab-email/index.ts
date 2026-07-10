import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Parse YYYY-MM-DD without timezone shifting (uses local time components)
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Dynamic import for Resend to avoid npm: specifier issues
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "DraftKit Notifications <notifications@draftkit.app>";

const LOGO_URL = "https://cbgchxesngdsvkevbqwh.supabase.co/storage/v1/object/public/email-assets/draftkit-logo.png?v=1";

// Escape user-controlled values before interpolating into HTML email templates
// to prevent HTML injection / phishing content in delivered emails.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const brandHeader = `
          <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
            <img src="${LOGO_URL}" alt="DraftKit" width="48" height="48" style="display: block; margin: 0 auto 12px;" />
            <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">DraftKit</span>
            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">The engine for creators who ship together</p>
          </div>`;

async function sendEmail(to: string[], subject: string, html: string, replyTo?: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      reply_to: replyTo || "hello@draftkit.app",
      to,
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();

    // Resend blocks sending to non-owner addresses until a domain is verified.
    // Don't hard-fail the whole app flow—treat email as "best effort" and
    // return a 200 with a "skipped" response so the UI doesn't break.
    if (
      response.status === 403 &&
      (errorText.includes("You can only send testing emails") ||
        errorText.includes("validation_error"))
    ) {
      console.warn(
        "Resend email skipped (domain not verified / testing restriction):",
        errorText,
      );
      return { skipped: true, reason: "RESEND_DOMAIN_NOT_VERIFIED", error: errorText };
    }

    throw new Error(`Resend API error: ${errorText}`);
  }
  
  return await response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "request_approved" | "request_declined" | "request_received" | "request_submitted" | "request_cancelled_by_guest" | "collab_cancelled_by_host" | "new_message" | "new_message_from_guest" | "collab_reminder" | "collab_type_changed" | "workspace_updated_by_creator" | "workspace_updated_by_guest" | "collab_rescheduled" | "collab_published" | "workspace_invite";
  requestId: string;
  messageContent?: string;
  newCollabType?: string;
  newDate?: string;
  inviteeEmail?: string;
  // Sender email for messaging fan-out. When set, the sender is excluded
  // from recipient list (prevents self-emails on solo/project workspaces).
  senderEmail?: string;
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

function extractCreatorEmail(creatorRow: any): string | null {
  const cc = creatorRow?.creator_contacts;
  if (!cc) return null;
  if (Array.isArray(cc)) return cc[0]?.email ?? null;
  return cc.email ?? null;
}

// Valid email types mapped to required sender roles
const EMAIL_TYPE_ROLES: Record<EmailRequest["type"], "creator" | "requester" | "service"> = {
  request_approved: "creator",
  request_declined: "creator",
  request_received: "service",
  request_submitted: "service",
  request_cancelled_by_guest: "requester",
  collab_cancelled_by_host: "creator",
  new_message: "creator",
  new_message_from_guest: "requester",
  collab_reminder: "service",
  collab_type_changed: "creator",
  collab_rescheduled: "creator",
  workspace_updated_by_creator: "creator",
  workspace_updated_by_guest: "requester",
  collab_published: "creator",
  workspace_invite: "creator",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { type, requestId, messageContent, newCollabType, newDate, inviteeEmail, senderEmail }: EmailRequest = await req.json();

    if (!type || !requestId) {
      return new Response(
        JSON.stringify({ error: "Missing type or requestId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requiredRole = EMAIL_TYPE_ROLES[type];
    if (!requiredRole) {
      return new Response(
        JSON.stringify({ error: "Invalid email type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- AUTHENTICATION & AUTHORIZATION ---
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isServiceRole = false;

    // Check for service role (used by scheduled functions)
    if (authHeader?.includes(supabaseServiceKey)) {
      isServiceRole = true;
      console.log("Request authenticated via service role");
    } else if (authHeader?.startsWith("Bearer ")) {
      // Validate user JWT
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
      
      if (!userError && user) {
        userId = user.id;
        console.log(`Request authenticated as user: ${userId}`);
      }
    }

    // For service-only email types, require service role
    if (requiredRole === "service" && !isServiceRole) {
      // Allow "request_received" from unauthenticated users (public booking)
      if (type !== "request_received") {
        console.error(`Unauthorized: ${type} requires service role`);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For creator/requester email types, require authentication
    if ((requiredRole === "creator" || requiredRole === "requester") && !userId && !isServiceRole) {
      console.error(`Unauthorized: ${type} requires authentication`);
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the request with creator info
    const { data: request, error: requestError } = await supabase
      .from("collab_requests")
      .select(`
        *,
        creators (
          name,
          username,
          collab_style,
          collab_guidelines,
          newsletter_url,
          creator_contacts ( email )
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

    // --- AUTHORIZATION CHECK ---
    // Verify the authenticated user is authorized for this email type
    if (!isServiceRole && userId) {
      // Get the creator's user_id for this request
      const { data: creator } = await supabase
        .from("creators")
        .select("user_id")
        .eq("id", request.creator_id)
        .single();

      const creatorUserId = creator?.user_id;
      const requesterUserId = request.requester_user_id;

      if (requiredRole === "creator" && creatorUserId !== userId) {
        console.error(`Unauthorized: user ${userId} is not the creator (${creatorUserId}) for request ${requestId}`);
        return new Response(
          JSON.stringify({ error: "You are not authorized to send this email" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (requiredRole === "requester" && requesterUserId !== userId) {
        console.error(`Unauthorized: user ${userId} is not the requester (${requesterUserId}) for request ${requestId}`);
        return new Response(
          JSON.stringify({ error: "You are not authorized to send this email" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // --- END AUTHORIZATION CHECK ---

    const creatorName = request.creators?.name || "Creator";
    const creatorEmail = extractCreatorEmail(request.creators);
    const creatorUsername = request.creators?.username;
    const requesterName = request.requester_name;
    const requesterEmail = request.requester_email;
    const requestedDate = request.requested_date;
    const collabStyle = request.creators?.collab_style || "Virtual Coffee";
    const collabGuidelines = request.creators?.collab_guidelines;
    const aiDraft = request.ai_draft as CollabDraft | null;

    // HTML-escaped copies of user-controlled fields for safe interpolation
    // into email templates. Raw values are kept above for plain-text uses
    // (subjects, analytics, normalization) where HTML escaping is unwanted.
    const creatorNameHtml = escapeHtml(creatorName);
    const requesterNameHtml = escapeHtml(requesterName ?? "");
    const requesterEmailHtml = escapeHtml(requesterEmail ?? "");
    const requestMessageHtml = escapeHtml(request.message ?? "");
    const messageContentHtml = escapeHtml(messageContent ?? "");


    // --- SOLO WORKSPACE DETECTION ---
    // A row is "effectively solo" when is_solo is set, or when both sides
    // resolve to the same user, or when the names collapse to the same
    // person. This prevents emails from rendering "With: Karen and Karen"
    // or sending reminders to one person about a meeting with themselves.
    const _requesterUserIdForSolo = request.requester_user_id ?? null;
    const _creatorRow = request.creator_id
      ? await supabase
          .from("creators")
          .select("user_id")
          .eq("id", request.creator_id)
          .maybeSingle()
      : null;
    const _creatorUserIdForSolo = _creatorRow?.data?.user_id ?? null;
    const _normName = (n: string | null | undefined) =>
      (n ?? "").trim().toLowerCase();
    const isEffectivelySolo =
      !!request.is_solo ||
      (!!_creatorUserIdForSolo &&
        !!_requesterUserIdForSolo &&
        _creatorUserIdForSolo === _requesterUserIdForSolo) ||
      (!!_normName(creatorName) &&
        _normName(creatorName) === _normName(requesterName));

    // Render a deduped, solo-aware participants line for email copy.
    const renderParticipantsLine = (extraNames: string[] = []): string => {
      const seen = new Set<string>();
      const out: string[] = [];
      const push = (raw: string | null | undefined) => {
        const v = (raw ?? "").trim();
        if (!v) return;
        const key = v.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(v);
      };
      push(creatorName);
      if (!isEffectivelySolo) push(requesterName);
      for (const n of extraNames) push(n);
      if (out.length === 0) return "";
      if (out.length === 1) return isEffectivelySolo ? `${out[0]} (solo)` : out[0];
      if (out.length === 2) return `${out[0]} and ${out[1]}`;
      if (out.length === 3) return `${out[0]}, ${out[1]} and ${out[2]}`;
      return `${out[0]}, ${out[1]} and ${out.length - 2} others`;
    };

    // Format the requested date nicely
    const formattedDate = requestedDate 
      ? parseDateString(requestedDate).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long", 
          day: "numeric",
          year: "numeric"
        })
      : "Flexible date";

    // Build the booking page URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://draftkit.app";
    const bookingUrl = `${baseUrl}/${creatorUsername}`;
    
    // Helper to build safe deep-link URLs that work around server-side routing
    // Uses /dashboard?open=requests&highlight=... format which the client then redirects
    const buildDashboardRequestLink = (reqId: string) =>
      `${baseUrl}/dashboard?open=requests&highlight=${encodeURIComponent(reqId)}`;

    let emailSubject = "";
    let emailHtml = "";
    let toEmail = "";

    if (type === "request_approved") {
      toEmail = requesterEmail;
      emailSubject = `🎉 ${creatorName} approved your collaboration request!`;
      
      // Build draft section if available
      let draftSection = "";
      if (aiDraft) {
        draftSection = `
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px;">✨ Collaboration Draft</h3>
            <p style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #d9826b;">${aiDraft.title}</p>
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
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px;">📋 ${creatorNameHtml}'s Collaboration Playbook</h3>
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
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">✨ Collaboration Approved!</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Great news! <strong>${creatorNameHtml}</strong> has approved your collaboration request${requestedDate ? ` for <strong>${formattedDate}</strong>` : ""}.
          </p>

          ${draftSection}
          
          ${playbookSection}

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Ready to start drafting?</p>
            <a href="https://collabstack.lovable.app/dashboard/my-requests" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Your Workspace →
            </a>
            <p style="margin: 12px 0 0 0; font-size: 13px; color: #94a3b8;">Sign up or log in to start drafting with ${creatorNameHtml}</p>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
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
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">📬 Request Update</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Thank you for reaching out to <strong>${creatorNameHtml}</strong> for a collaboration. Unfortunately, they're unable to proceed with this request at this time.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            This doesn't mean the door is closed forever—schedules change, and there may be opportunities in the future. Keep creating great content!
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Looking for other collaborators?</p>
            <a href="${baseUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Discover More Creators
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Best of luck,<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "request_received") {
      // Email to host when they receive a new request
      toEmail = creatorEmail || "";
      emailSubject = `🔔 New collaboration request from ${requesterName}`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">📨 New Collaboration Request</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${creatorNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${requesterNameHtml}</strong> wants to collaborate with you${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}!
          </p>

          ${request.message ? `
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Their message:</p>
            <p style="margin: 0; color: #1e293b; white-space: pre-line;">${requestMessageHtml}</p>
          </div>
          ` : ""}

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="${buildDashboardRequestLink(requestId)}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Request
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "request_submitted") {
      // Guest confirmation email - sent to requester after they submit a booking
      toEmail = requesterEmail;
      emailSubject = `✅ Your collaboration request with ${creatorName} was submitted`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">✅ Request Submitted!</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Your collaboration request with <strong>${creatorNameHtml}</strong>${requestedDate ? ` for <strong>${formattedDate}</strong>` : ""} has been successfully submitted.
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px;">📋 What happens next?</h3>
            <ol style="margin: 0; padding-left: 20px; color: #475569;">
              <li style="margin-bottom: 8px;"><strong>${creatorNameHtml}</strong> will review your request</li>
              <li style="margin-bottom: 8px;">You'll receive an email when they respond</li>
              <li style="margin-bottom: 0;">If approved, you'll get collaboration details and next steps</li>
            </ol>
          </div>

          ${request.message ? `
          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Your message:</p>
            <p style="margin: 0; color: #1e293b; white-space: pre-line; font-style: italic;">"${requestMessageHtml}"</p>
          </div>
          ` : ""}

          <div style="background: #ecfdf5; border-radius: 12px; padding: 16px 24px; margin: 24px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0; color: #065f46; font-size: 14px;">
              💡 <strong>Tip:</strong> While you wait, why not create your own DraftKit page to receive collaboration requests?
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${baseUrl}/signup" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Create Your Page
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "request_cancelled_by_guest") {
      // Email to host when guest cancels their pending request
      toEmail = creatorEmail || "";
      emailSubject = `📋 ${requesterName} cancelled their collaboration request`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">📋 Request Cancelled</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${creatorNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${requesterNameHtml}</strong> has cancelled their collaboration request${requestedDate ? ` for <strong>${formattedDate}</strong>` : ""}.
          </p>

          ${requestedDate ? `
          <div style="background: #ecfdf5; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0; color: #065f46;">
              ✅ <strong>${formattedDate}</strong> is now available again for other collaborations.
            </p>
          </div>
          ` : ""}

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="${buildDashboardRequestLink(requestId)}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View All Requests
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "collab_cancelled_by_host") {
      // Email to guest when host cancels an approved collaboration
      toEmail = requesterEmail;
      emailSubject = `Update: Your collaboration with ${creatorName} has been cancelled`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">📅 Collaboration Cancelled</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Unfortunately, <strong>${creatorNameHtml}</strong> has had to cancel your upcoming collaboration${requestedDate ? ` scheduled for <strong>${formattedDate}</strong>` : ""}.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            We know this is disappointing, but schedules change. Don't let this discourage you—there are plenty of other amazing creators to collaborate with!
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Looking for other collaborators?</p>
            <a href="${baseUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Discover More Creators
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Best of luck,<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "new_message") {
      // Email to guest when host sends them a message
      toEmail = requesterEmail;
      emailSubject = `💬 New message from ${creatorName} about your collaboration`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">💬 New Message</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${creatorNameHtml}</strong> sent you a message about your collaboration${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}:
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <p style="margin: 0; color: #1e293b; white-space: pre-line; font-size: 16px;">${messageContentHtml}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="mailto:${creatorEmail}?subject=Re: Collaboration${requestedDate ? ` on ${formattedDate}` : ""}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Reply to ${creatorNameHtml}
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "new_message_from_guest") {
      // Email to creator when guest sends them a message
      toEmail = creatorEmail || "";
      emailSubject = `💬 New message from ${requesterName} about your collaboration`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">💬 New Message</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${creatorNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${requesterNameHtml}</strong> sent you a message about your collaboration${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}:
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <p style="margin: 0; color: #1e293b; white-space: pre-line; font-size: 16px;">${messageContentHtml}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="${buildDashboardRequestLink(requestId)}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Request & Reply
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "collab_reminder") {
      // Solo workspaces have no second party — skip the "you have a collab
      // with X" reminder entirely instead of emailing Karen about Karen.
      if (isEffectivelySolo) {
        console.log(`Skipping collab_reminder for solo request ${requestId}`);
        return new Response(
          JSON.stringify({ success: true, skipped: "solo_workspace" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Send reminders to BOTH host and guest
      const hostEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">⏰ Collaboration Reminder</h1>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Just a friendly reminder that you have a collaboration with <strong>${requesterNameHtml}</strong> coming up on <strong>${formattedDate}</strong>!
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Collaborator:</p>
            <p style="margin: 0 0 16px 0; color: #1e293b;">${requesterNameHtml} (${requesterEmailHtml})</p>
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Date:</p>
            <p style="margin: 0; color: #1e293b;">${formattedDate}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="${buildDashboardRequestLink(requestId)}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Details
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;

      const guestEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">⏰ Collaboration Reminder</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            Just a friendly reminder that you have a collaboration with <strong>${creatorNameHtml}</strong> coming up on <strong>${formattedDate}</strong>!
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Creator:</p>
            <p style="margin: 0 0 16px 0; color: #1e293b;">${creatorNameHtml}</p>
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Date:</p>
            <p style="margin: 0; color: #1e293b;">${formattedDate}</p>
          </div>

          ${collabGuidelines ? `
          <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px;">📋 ${creatorNameHtml}'s Collaboration Playbook</h3>
            <p style="margin: 0 0 8px 0; color: #78350f;"><strong>Style:</strong> ${collabStyle}</p>
            <p style="margin: 0; color: #78350f; white-space: pre-line;">${collabGuidelines}</p>
          </div>
          ` : ""}

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <a href="mailto:${creatorEmail}?subject=Re: Collaboration on ${formattedDate}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Contact ${creatorNameHtml}
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;

      // Send emails to both parties
      const hostEmailSubject = `⏰ Reminder: Collaboration with ${requesterNameHtml} on ${formattedDate}`;
      const guestEmailSubject = `⏰ Reminder: Collaboration with ${creatorNameHtml} on ${formattedDate}`;

      const emailPromises = [];
      
      if (creatorEmail) {
        emailPromises.push(sendEmail([creatorEmail], hostEmailSubject, hostEmailHtml, requesterEmail));
      }
      if (requesterEmail) {
        emailPromises.push(sendEmail([requesterEmail], guestEmailSubject, guestEmailHtml, creatorEmail || undefined));
      }

      await Promise.all(emailPromises);

      console.log(`Reminder emails sent successfully to both parties for request ${requestId}`);

      return new Response(
        JSON.stringify({ success: true, message: "Reminder emails sent to both parties" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle collab_type_changed email
    if (type === "collab_type_changed") {
      toEmail = requesterEmail;
      const collabTypeName = newCollabType || request.selected_collab_type || "Updated";
      emailSubject = `📝 Collaboration type updated with ${creatorName}`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <h1 style="margin: 0 0 24px; font-size: 24px; color: #1e293b; text-align: center;">Collaboration Type Updated</h1>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${creatorNameHtml}</strong> has updated the collaboration type for your upcoming collaboration${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}.
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">New Collaboration Type</p>
            <p style="margin: 0; font-size: 24px; font-weight: 600; color: #d9826b;">${collabTypeName}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px; color: #475569;">
            ${collabTypeName === "Virtual Coffee" 
              ? "This means you'll have a 30-60 minute video call to discuss your collaboration."
              : collabTypeName === "Async Drafting"
              ? "This means you'll collaborate asynchronously through shared drafts and written feedback."
              : collabTypeName === "Interview Style"
              ? "This means you'll exchange Q&A in a structured interview format."
              : "Please reach out to the creator for more details on what to expect."
            }
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Have questions about the change?</p>
            <a href="mailto:${creatorEmail}?subject=Re: Collaboration type update" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Contact ${creatorNameHtml}
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "collab_rescheduled") {
      toEmail = requesterEmail;
      const newFormattedDate = newDate
        ? parseDateString(newDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : "a new date";
      emailSubject = `📅 Collaboration with ${creatorName} rescheduled`;

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <h1 style="margin: 0 0 24px; font-size: 24px; color: #1e293b; text-align: center;">Collaboration Rescheduled</h1>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>

          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${creatorNameHtml}</strong> has rescheduled your collaboration to a new date.
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">New Date</p>
            <p style="margin: 0; font-size: 24px; font-weight: 600; color: #d9826b;">${newFormattedDate}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Questions about the new date?</p>
            <a href="mailto:${creatorEmail}?subject=Re: Rescheduled collaboration"
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Contact ${creatorNameHtml}
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "workspace_updated_by_creator") {
      // Creator updated workspace → email goes to guest
      toEmail = requesterEmail;
      emailSubject = `✏️ ${creatorName} updated the shared workspace`;

      const workspaceUrl = `${baseUrl}/dashboard/workspace/${requestId}`;

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <h1 style="margin: 0 0 24px; font-size: 24px; color: #1e293b; text-align: center;">Workspace Updated</h1>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${creatorNameHtml}</strong> has made updates to the shared workspace for your collaboration${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}.
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Check out the latest changes:</p>
            <a href="${workspaceUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Workspace
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "workspace_updated_by_guest") {
      // Guest updated workspace → email goes to creator
      toEmail = creatorEmail || "";
      emailSubject = `✏️ ${requesterName} updated the shared workspace`;

      const workspaceUrl = `${baseUrl}/dashboard/workspace/${requestId}`;

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <h1 style="margin: 0 0 24px; font-size: 24px; color: #1e293b; text-align: center;">Workspace Updated</h1>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${creatorNameHtml},</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${requesterNameHtml}</strong> has made updates to the shared workspace for your collaboration${requestedDate ? ` on <strong>${formattedDate}</strong>` : ""}.
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Check out the latest changes:</p>
            <a href="${workspaceUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Workspace
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Happy collaborating!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "collab_published") {
      // Solo workspace has no partner to notify — short-circuit.
      if (isEffectivelySolo) {
        console.log(`Skipping collab_published for solo request ${requestId}`);
        return new Response(
          JSON.stringify({ success: true, skipped: "solo_workspace" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Notify the partner (guest) that the collaboration is officially published
      toEmail = requesterEmail;
      emailSubject = `🎉 Your collaboration with ${creatorName} is live!`;

      const workspaceUrl = `${baseUrl}/dashboard/workspace/${requestId}`;

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">🎉 Collaboration Published!</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${requesterNameHtml},</p>

          <p style="font-size: 16px; margin-bottom: 24px;">
            Great news — <strong>${creatorNameHtml}</strong> has marked your collaboration as officially published! 🚀
          </p>

          <p style="font-size: 16px; margin-bottom: 24px; color: #475569;">
            The work you shipped together is now out in the world. Give yourself a moment to celebrate — this is what creating together is all about.
          </p>

          <div style="background: #ecfdf5; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0; color: #065f46; font-size: 14px;">
              💡 <strong>Keep the momentum going:</strong> Share your published work and tag each other — it's the best way to grow together.
            </p>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">View the final shared workspace:</p>
            <a href="${workspaceUrl}"
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Published Work
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            Congratulations on shipping together!<br>
            The DraftKit Team
          </p>
        </body>
        </html>
      `;
    } else if (type === "workspace_invite") {
      // Invitation to join a Writer's Room
      if (!inviteeEmail) {
        return new Response(
          JSON.stringify({ error: "Missing inviteeEmail" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      toEmail = inviteeEmail;
      const workspaceUrl = `${baseUrl}/dashboard/workspace/${requestId}`;
      emailSubject = `✍️ ${creatorName} invited you to collaborate on DraftKit`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${brandHeader}
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 24px; color: #1e293b;">✍️ You're Invited to a Writer's Room</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px;">Hi there,</p>
          
          <p style="font-size: 16px; margin-bottom: 24px;">
            <strong>${creatorNameHtml}</strong> has invited you to join a collaboration workspace on DraftKit — a shared space where writers draft together asynchronously.
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #d9826b;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">About this collaboration:</p>
            <p style="margin: 0; color: #1e293b;">
              ${request.selected_collab_type ? `<strong>Type:</strong> ${request.selected_collab_type}<br>` : ""}
              ${requestedDate ? `<strong>Target date:</strong> ${formattedDate}<br>` : ""}
              <strong>With:</strong> ${renderParticipantsLine()}
            </p>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px 0; color: #475569;">Join the workspace to start drafting:</p>
            <a href="${workspaceUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Writer's Room →
            </a>
            <p style="margin: 12px 0 0 0; font-size: 13px; color: #94a3b8;">You'll need a free DraftKit account to access the workspace.</p>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
            See you in the Room!<br>
            The DraftKit Team
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

    // --- MESSAGING FAN-OUT ---
    // For workspace messages we can't just email the "other side" of the
    // classic host/guest pair — project-linked workspaces are often solo
    // (creator === requester) with real recipients living in
    // workspace_collaborators. Build the full participant list and drop
    // the sender so nobody receives their own message.
    const normEmail = (e: string | null | undefined) =>
      (e ?? "").trim().toLowerCase();

    let recipients: string[] = [toEmail];

    if (type === "new_message" || type === "new_message_from_guest") {
      const pool = new Set<string>();
      const add = (e: string | null | undefined) => {
        const n = normEmail(e);
        if (!n) return;
        pool.add(n);
      };

      add(creatorEmail);
      add(requesterEmail);

      // Pull workspace collaborator emails (explicit + user_id lookup).
      const { data: collabRows } = await supabase
        .from("workspace_collaborators")
        .select("email, user_id")
        .eq("request_id", requestId);

      for (const row of collabRows ?? []) {
        if (row.email) add(row.email);
      }

      const collabUserIds = (collabRows ?? [])
        .map((r) => r.user_id)
        .filter((v): v is string => !!v);

      if (collabUserIds.length) {
        const { data: collabCreators } = await supabase
          .from("creators")
          .select("id, user_id, creator_contacts ( email )")
          .in("user_id", collabUserIds);
        for (const c of collabCreators ?? []) {
          add(extractCreatorEmail(c));
        }
      }

      if (senderEmail) pool.delete(normEmail(senderEmail));

      recipients = Array.from(pool);

      if (recipients.length === 0) {
        console.log(`No recipients for ${type} after excluding sender ${senderEmail}`);
        return new Response(
          JSON.stringify({ skipped: true, reason: "NO_RECIPIENTS_AFTER_SENDER_EXCLUSION" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- DUPLICATE EMAIL GUARDRAIL ---
    // Prevent sending duplicate emails within a short window (2 minutes)
    // Excludes collab_reminder as reminders may legitimately repeat
    const DEDUP_TYPES = [
      "request_received",
      "request_approved", 
      "request_declined",
      "request_cancelled_by_guest",
      "collab_cancelled_by_host",
      "new_message",
      "new_message_from_guest",
      "collab_type_changed",
      "workspace_updated_by_creator",
      "workspace_updated_by_guest",
      "collab_published",
      "collab_rescheduled",
      "workspace_invite"
    ];

    // Send the email
    // Determine reply-to based on email type
    const replyToMap: Record<string, string | undefined> = {
      request_approved: creatorEmail || undefined,
      request_declined: creatorEmail || undefined,
      request_received: requesterEmail,
      request_submitted: undefined, // keep default hello@draftkit.app
      new_message: creatorEmail || undefined,
      new_message_from_guest: requesterEmail,
      collab_type_changed: creatorEmail || undefined,
      workspace_updated_by_creator: creatorEmail || undefined,
      workspace_updated_by_guest: requesterEmail,
      request_cancelled_by_guest: requesterEmail,
      collab_cancelled_by_host: creatorEmail || undefined,
      collab_published: creatorEmail || undefined,
      collab_rescheduled: creatorEmail || undefined,
      workspace_invite: creatorEmail || undefined,
    };
    const replyTo = replyToMap[type];

    const results: Array<{ to: string; id?: string; skipped?: boolean }> = [];
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    for (const to of recipients) {
      if (DEDUP_TYPES.includes(type)) {
        const { data: recentSend } = await supabase
          .from("email_events")
          .select("id")
          .eq("request_id", requestId)
          .eq("type", type)
          .eq("to_email", to)
          .gte("created_at", twoMinutesAgo)
          .limit(1)
          .maybeSingle();

        if (recentSend) {
          console.log(`Duplicate email skipped (${type} → ${to})`);
          results.push({ to, skipped: true });
          continue;
        }
      }

      const emailResponse = await sendEmail([to], emailSubject, emailHtml, replyTo);

      if (!emailResponse.skipped) {
        await supabase.from("email_events").insert({
          request_id: requestId,
          type,
          to_email: to,
          provider_id: emailResponse.id || null,
          status: "sent"
        });
      }

      results.push({ to, id: emailResponse.id, skipped: !!emailResponse.skipped });
    }

    const emailResponse = results[0] ?? { skipped: true };
    console.log(`Email sent (${type}) →`, results.map((r) => r.to).join(", "));

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
