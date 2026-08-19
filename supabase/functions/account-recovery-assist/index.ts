// Edge function: account-recovery-assist
//
// Single entry point for "I can't get in" on the forgot-password page.
// Invited guests often have no auth account at all, so a plain password reset
// silently sends nothing and they get stuck in a loop. This resolves the email
// into one of three outcomes and always sends the right thing:
//   1. Account exists          -> password reset email
//   2. No account, has invites -> claim-your-invitations email
//   3. Neither                 -> nothing
// The response shape is constant so the client cannot enumerate accounts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOGO_URL =
  "https://cbgchxesngdsvkevbqwh.supabase.co/storage/v1/object/public/email-assets/draftkit-logo.png?v=1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Per-instance throttle: one assist email per address per 60s.
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function claimEmailHtml(email: string, signupUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
        <img src="${LOGO_URL}" alt="DraftKit" width="48" height="48" style="display: block; margin: 0 auto 12px;" />
        <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">DraftKit</span>
      </div>

      <h1 style="margin: 0 0 24px; font-size: 24px; text-align: center;">You have collaborations waiting</h1>

      <p style="font-size: 16px; margin-bottom: 16px;">
        You asked to reset your DraftKit password, but there's no account on
        <strong>${escapeHtml(email)}</strong> yet. That's why the reset emails never arrived.
      </p>

      <p style="font-size: 16px; margin-bottom: 16px;">
        Someone invited you to collaborate using this address. Create your free account with
        the same email and everything they shared with you will be waiting inside.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Create your account &rarr;
        </a>
        <p style="margin: 12px 0 0; font-size: 13px; color: #94a3b8;">
          Use ${escapeHtml(email)} exactly, or your invitations won't link up.
        </p>
      </div>

      <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
        Stuck? Reply to this email and we'll sort it out.<br>
        The DraftKit Team
      </p>
    </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Constant response so callers learn nothing about account existence.
  const ok = () =>
    new Response(JSON.stringify({ handled: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = (await req.json()) as { email?: string; redirectTo?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const previous = lastSent.get(email);
    if (previous && now - previous < THROTTLE_MS) {
      return ok();
    }
    lastSent.set(email, now);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const baseUrl = Deno.env.get("SITE_URL") || "https://draftkit.app";

    // 1. Does an auth account exist? GoTrue admin filter is the only reliable
    // lookup — auth.users is not reachable through PostgREST.
    const lookup = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    let hasAccount = false;
    if (lookup.ok) {
      const payload = await lookup.json();
      const users: Array<{ email?: string }> = payload?.users ?? [];
      hasAccount = users.some((u) => (u.email ?? "").toLowerCase() === email);
    } else {
      console.error(`auth lookup failed [${lookup.status}]`, await lookup.text());
    }

    if (hasAccount) {
      const anon = createClient(supabaseUrl, anonKey);
      const redirectTo =
        typeof body.redirectTo === "string" && body.redirectTo.startsWith(baseUrl)
          ? body.redirectTo
          : `${baseUrl}/reset-password`;
      const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) console.error("reset email failed:", error.message);
      return ok();
    }

    // 2. No account. Are there invitations tied to this address?
    const admin = createClient(supabaseUrl, serviceKey);
    const [collaborators, members, requests] = await Promise.all([
      admin.from("workspace_collaborators").select("id").eq("email", email).limit(1),
      admin.from("project_members").select("id").eq("email", email).limit(1),
      admin.from("collab_requests").select("id").eq("requester_email", email).limit(1),
    ]);

    const hasPendingInvite =
      (collaborators.data?.length ?? 0) > 0 ||
      (members.data?.length ?? 0) > 0 ||
      (requests.data?.length ?? 0) > 0;

    if (!hasPendingInvite) {
      console.log(`recovery assist: no account and no invites for ${email}`);
      return ok();
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY missing — claim-invite email skipped");
      return ok();
    }

    const signupUrl = `${baseUrl}/signup?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/dashboard/collaborations")}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DraftKit <notifications@draftkit.app>",
        reply_to: "hello@draftkit.app",
        to: [email],
        subject: "Your DraftKit invitations are waiting — finish signing up",
        html: claimEmailHtml(email, signupUrl),
      }),
    });

    if (!response.ok) {
      console.error(
        `Resend error [${response.status}]: ${await response.text()}`,
      );
    } else {
      console.log(`recovery assist: claim-invite email sent to ${email}`);
    }

    return ok();
  } catch (err) {
    console.error("account-recovery-assist error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
