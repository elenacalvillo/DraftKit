// Edge function: send-project-invite
//
// Notifies someone that they were added to a book project (Writer's Room) and
// gives them a single accept link. Project-level invites previously wrote a
// database row silently, so invitees never learned they had access.
//
// Auth: caller must be the project owner or a project admin.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOGO_URL =
  "https://cbgchxesngdsvkevbqwh.supabase.co/storage/v1/object/public/email-assets/draftkit-logo.png?v=1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLE_COPY: Record<string, { label: string; blurb: string }> = {
  admin: { label: "Admin", blurb: "full project control" },
  chapter_writer: {
    label: "Chapter Writer",
    blurb: "writes and edits assigned chapters",
  },
  peer_reviewer: {
    label: "Peer Reviewer",
    blurb: "comments on assigned chapters, no editing",
  },
  cross_chapter_reviewer: {
    label: "Cross-chapter Reviewer",
    blurb: "comments across every chapter, no editing",
  },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Keep the From domain on draftkit.app so SPF/DKIM/DMARC stay aligned while
// still naming the human who invited them.
function buildFromHeader(fromName?: string | null): string {
  const clean = (fromName ?? "").replace(/[<>"\r\n]/g, "").trim();
  if (!clean) return "DraftKit Notifications <notifications@draftkit.app>";
  return `${clean} via DraftKit <notifications@draftkit.app>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } =
      await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = (await req.json()) as {
      projectId?: string;
      email?: string;
    };
    const projectId = body.projectId;
    const inviteeEmail = (body.email ?? "").trim().toLowerCase();
    if (!projectId || !inviteeEmail) {
      return new Response(
        JSON.stringify({ error: "projectId and email are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Authorize: owner or project admin
    const { data: isOwner } = await supabase.rpc("is_project_owner", {
      _user_id: user.id,
      _project_id: projectId,
    });
    let authorized = !!isOwner;
    if (!authorized) {
      const { data: adminRow } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      authorized = !!adminRow;
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Not authorized for this project" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // The invite must already exist as a member row.
    const { data: member } = await supabase
      .from("project_members")
      .select("email, role, joined_at")
      .eq("project_id", projectId)
      .eq("email", inviteeEmail)
      .maybeSingle();
    if (!member) {
      return new Response(
        JSON.stringify({ error: "That person is not a member of this project" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: projectRow, error: projectErr } = await supabase
      .from("projects")
      .select("id, title, creators!inner(name)")
      .eq("id", projectId)
      .single();
    if (projectErr) throw projectErr;
    const project = projectRow as unknown as {
      id: string;
      title: string;
      creators: { name: string } | { name: string }[];
    };
    const creatorRow = Array.isArray(project.creators)
      ? project.creators[0]
      : project.creators;
    const hostName = creatorRow?.name || user.email || "A DraftKit writer";

    const baseUrl = Deno.env.get("SITE_URL") || "https://draftkit.app";
    const acceptPath = `/dashboard/projects/${project.id}/accept`;
    const acceptUrl = `${baseUrl}${acceptPath}`;
    const signupUrl = `${baseUrl}/signup?next=${encodeURIComponent(acceptPath)}`;

    const role = ROLE_COPY[member.role] ?? {
      label: member.role,
      blurb: "project collaborator",
    };

    const subject = `${hostName} invited you to ${project.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
          <img src="${LOGO_URL}" alt="DraftKit" width="48" height="48" style="display: block; margin: 0 auto 12px;" />
          <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">DraftKit</span>
        </div>

        <h1 style="margin: 0 0 24px; font-size: 24px; text-align: center;">You're invited to a book project</h1>

        <p style="font-size: 16px; margin-bottom: 24px;">
          <strong>${escapeHtml(hostName)}</strong> invited you to join
          <strong>${escapeHtml(project.title)}</strong> on DraftKit.
        </p>

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #d9826b;">
          <p style="margin: 0; color: #1e293b;">
            <strong>Your role:</strong> ${escapeHtml(role.label)}<br>
            <span style="color: #475569;">${escapeHtml(role.blurb)}</span>
          </p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Accept invitation →
          </a>
          <p style="margin: 12px 0 0; font-size: 13px; color: #94a3b8;">
            No DraftKit account yet? <a href="${signupUrl}" style="color: #d9826b;">Create one free</a> with this email address and you'll land straight on the project.
          </p>
        </div>

        <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
          Reply to this email to reach ${escapeHtml(hostName)} directly.<br>
          The DraftKit Team
        </p>
      </body>
      </html>
    `;

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY missing — project invite email skipped");
      return new Response(
        JSON.stringify({ skipped: true, reason: "RESEND_API_KEY missing" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: buildFromHeader(hostName),
        reply_to: user.email ?? "hello@draftkit.app",
        to: [inviteeEmail],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Resend error [${response.status}]: ${text}`);
      return new Response(
        JSON.stringify({
          error: "Invitation email could not be sent",
          status: response.status,
          details: text,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await response.json();
    console.log(
      `project invite sent project=${projectId} to=${inviteeEmail} id=${result?.id ?? "n/a"}`,
    );

    return new Response(JSON.stringify({ sent: true, email: inviteeEmail }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-project-invite error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
