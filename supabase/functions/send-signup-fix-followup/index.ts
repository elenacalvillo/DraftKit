// =============================================================
// send-signup-fix-followup
//
// One-off: emails the corrected apology + retry nudge to users
// who were blocked by the create_creator_profile bug. Yesterday's
// "we fixed it" email went out before the underlying RPC was
// actually repaired (the function still wrote to a dropped
// `creators.email` column), so a second, honest pass is owed.
//
// Gated by CRON_SECRET. Accepts { user_ids: string[] } in the
// request body. Looks up each user's email via the admin client
// (auth schema is not exposed through PostgREST). Sends via
// Resend. Returns a per-recipient status summary.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://draftkit.app";
const FROM_ADDRESS = "Elena at DraftKit <hello@draftkit.app>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUBJECT = "DraftKit signup fix (it really works now)";

const escapeHtml = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const bodyText = (url: string) => `Hi,

I'm Elena, the founder of DraftKit. I emailed you yesterday saying the "Failed to create profile" error was fixed. It wasn't, fully. A second issue inside the same database function was still blocking signups, and a few of you hit it again. I'm really sorry.

That second issue is now properly fixed and verified.

If you're still up for trying DraftKit, you can finish your signup here:

${url}

Thanks for your patience.

Best,
Elena`;

const bodyHtml = (url: string) => `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
    <tr><td>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi,</p>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">
        I'm Elena, the founder of DraftKit. I emailed you yesterday saying the <em>"Failed to create profile"</em> error was fixed. It wasn't, fully. A second issue inside the same database function was still blocking signups, and a few of you hit it again. I'm really sorry.
      </p>
      <p style="margin:0 0 24px;font-size:16px;color:#111827;line-height:1.6;">
        That second issue is now properly fixed and verified.
      </p>
      <p style="margin:0 0 24px;font-size:16px;color:#111827;line-height:1.6;">
        If you're still up for trying DraftKit, you can finish your signup here:
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#d9826b 0%,#c9946d 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Finish your signup →</a>
      </p>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">
        Thanks for your patience.
      </p>
      <p style="margin:32px 0 0;font-size:16px;color:#111827;">Best,<br/>Elena</p>
    </td></tr>
  </table>
</body></html>`;

async function sendEmail(to: string, url: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: SUBJECT,
      html: bodyHtml(url),
      text: bodyText(url),
    }),
  });
  if (!resp.ok) {
    throw new Error(`resend ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-internal-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { user_ids?: string[]; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body ok
  }
  const userIds = Array.isArray(body.user_ids) ? body.user_ids : [];
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ error: "user_ids required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const results: Array<{
    user_id: string;
    email: string | null;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }> = [];

  const url = `${APP_URL}/signup`;

  for (const uid of userIds) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(uid);
      if (error || !data?.user?.email) {
        results.push({
          user_id: uid,
          email: null,
          status: "skipped",
          error: error?.message ?? "no email",
        });
        continue;
      }
      const email = data.user.email;

      if (body.dry_run) {
        results.push({ user_id: uid, email, status: "skipped", error: "dry_run" });
        continue;
      }

      await sendEmail(email, url);
      results.push({ user_id: uid, email, status: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      results.push({
        user_id: uid,
        email: null,
        status: "failed",
        error: message,
      });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
