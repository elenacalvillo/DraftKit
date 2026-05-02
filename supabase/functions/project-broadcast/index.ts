// Edge function: project-broadcast
//
// Lets a project admin send a single broadcast message to every
// member of a project. Each recipient receives the same email; one
// broadcast row is logged in `project_broadcasts`, and one
// `email_events` row is logged per recipient with type
// `project_broadcast` (used for monitoring and dedup).
//
// Auth: requires the caller to be the project owner. The function
// performs the auth check explicitly using the Authorization header
// (we do not rely on RLS because we use service-role to write logs).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ||
  "DraftKit Notifications <notifications@draftkit.app>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  projectId: string;
  message: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(to: string, subject: string, html: string, replyTo: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing — broadcast email skipped");
    return { skipped: true } as const;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      reply_to: replyTo,
      to: [to],
      subject,
      html,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Resend API error", text);
    throw new Error(`Email send failed: ${text}`);
  }
  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    // Auth client (uses caller's JWT) for identifying the user
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } =
      await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    // Service-role client for trusted writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = (await req.json()) as BroadcastRequest;
    if (!body.projectId || !body.message?.trim()) {
      throw new Error("projectId and message are required");
    }

    // Authorize: caller must be project owner
    const { data: ownerCheck, error: ownerErr } = await supabase.rpc(
      "is_project_owner",
      { _user_id: user.id, _project_id: body.projectId },
    );
    if (ownerErr) throw ownerErr;
    if (!ownerCheck) {
      return new Response(
        JSON.stringify({ error: "Not authorized for this project" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Look up project + sender details
    const { data: projectRow, error: projectErr } = await supabase
      .from("projects")
      .select("id, title, creator_id, creators!inner(id, name)")
      .eq("id", body.projectId)
      .single();
    if (projectErr) throw projectErr;
    const project = projectRow as unknown as {
      id: string;
      title: string;
      creator_id: string;
      creators: { id: string; name: string } | { id: string; name: string }[];
    };
    const creatorRow = Array.isArray(project.creators)
      ? project.creators[0]
      : project.creators;
    const senderName = creatorRow?.name ?? user.email ?? "Project admin";
    const replyTo = user.email ?? "hello@draftkit.app";

    // Fetch members
    const { data: members, error: membersErr } = await supabase
      .from("project_members")
      .select("email")
      .eq("project_id", body.projectId);
    if (membersErr) throw membersErr;
    const emails = Array.from(
      new Set((members ?? []).map((m) => m.email).filter(Boolean)),
    );

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({
          warning: "There are no other members in this project yet.",
          recipientCount: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert broadcast log
    const { data: broadcastRow, error: insertErr } = await supabase
      .from("project_broadcasts")
      .insert({
        project_id: body.projectId,
        sender_id: user.id,
        sender_name: senderName,
        message: body.message.trim(),
        recipient_count: emails.length,
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    // Compose & send emails
    const subject = `You have a message from ${senderName} about ${project.title}`;
    const origin =
      req.headers.get("origin") || "https://collabstack.lovable.app";
    const projectUrl = `${origin}/dashboard/projects/${project.id}`;
    const htmlBody = `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="margin: 0 0 12px; color: #2a2318;">Writer's Room update</h2>
        <p style="margin: 0 0 8px; color: #475569;">
          <strong>${escapeHtml(senderName)}</strong> sent a broadcast to the
          <strong>${escapeHtml(project.title)}</strong> book project team.
        </p>
        <div style="border-left: 3px solid #6366f1; padding: 12px 16px; background: #f8fafc; margin: 16px 0; white-space: pre-wrap;">
${escapeHtml(body.message.trim())}
        </div>
        <p style="margin: 12px 0; font-size: 13px; color: #64748b;">
          Reply to this email to reach ${escapeHtml(senderName)} directly.
        </p>
        <p style="margin: 24px 0 0;">
          <a href="${projectUrl}" style="background: #6366f1; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Open project in DraftKit
          </a>
        </p>
      </div>
    `;

    let sent = 0;
    for (const email of emails) {
      try {
        const result = await sendEmail(email, subject, htmlBody, replyTo);
        const providerId =
          (result as { id?: string; skipped?: boolean }).id ?? null;
        await supabase.from("email_events").insert({
          request_id: broadcastRow.id,
          type: "project_broadcast",
          to_email: email,
          provider_id: providerId,
          status:
            (result as { skipped?: boolean }).skipped === true
              ? "skipped"
              : "sent",
        });
        if ((result as { skipped?: boolean }).skipped !== true) sent += 1;
      } catch (emailErr) {
        console.error(`Broadcast email failed for ${email}`, emailErr);
        await supabase.from("email_events").insert({
          request_id: broadcastRow.id,
          type: "project_broadcast",
          to_email: email,
          status: "failed",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        broadcastId: broadcastRow.id,
        recipientCount: sent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("project-broadcast error", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
