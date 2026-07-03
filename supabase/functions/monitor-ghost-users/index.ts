// =============================================================
// monitor-ghost-users
//
// Hourly health check that compares count(auth.users) -
// count(public.creators) (with a 1-hour grace window for users
// who just signed up and are mid-flow) and emails the admin if
// the gap exceeds GHOST_ALERT_THRESHOLD.
//
// State is tracked in public.ghost_user_alert_state so the same
// gap doesn't trigger an alert every hour. When the gap drops
// back below threshold the state resets, so a new alert fires
// the next time the gap reopens.
//
// Failures (Resend down, query errors, etc.) are logged and
// swallowed — by spec we never want this function to cascade
// alerts of its own.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("GHOST_ALERT_EMAIL") ?? "hello@draftkit.app";
const THRESHOLD = parseInt(Deno.env.get("GHOST_ALERT_THRESHOLD") ?? "3", 10);
const FROM_ADDRESS =
  Deno.env.get("GHOST_ALERT_FROM") ?? "DraftKit Alerts <alerts@draftkit.app>";
// Public diagnostic URL: the SQL editor with the diagnostic
// query pre-filled. We can't auto-fill the editor over a URL
// reliably across Supabase regions, so we just link to the
// editor and include the query verbatim in the email body.
const SUPABASE_PROJECT_REF =
  Deno.env.get("SUPABASE_PROJECT_REF") ?? "cbgchxesngdsvkevbqwh";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHOST_DIAGNOSTIC_SQL = `SELECT au.id, au.email, au.created_at, au.last_sign_in_at
FROM auth.users au
LEFT JOIN public.creators c ON c.user_id = au.id
WHERE c.id IS NULL
ORDER BY au.created_at DESC;`;

interface GhostRow {
  id: string;
  email: string;
  created_at?: string;
}

const escapeHtml = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Decide whether the current gap merits an alert. Pure function
 * so it can be unit-tested without standing up Supabase.
 *
 *   - alert when gap >= threshold AND gap is larger than the
 *     last alerted gap (handles growth correctly: 3 -> 5 alerts
 *     again, 5 -> 5 stays quiet).
 *   - reset (return shouldReset: true) when gap drops below
 *     threshold so a future re-opening fires a fresh alert.
 */
export function decideAlert(
  gap: number,
  threshold: number,
  lastAlertGap: number,
): { shouldAlert: boolean; shouldReset: boolean } {
  if (gap < threshold) {
    return { shouldAlert: false, shouldReset: lastAlertGap > 0 };
  }
  if (gap > lastAlertGap) {
    return { shouldAlert: true, shouldReset: false };
  }
  return { shouldAlert: false, shouldReset: false };
}

function renderAlertHtml(gap: number, ghosts: GhostRow[]): string {
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new`;
  const ghostList = ghosts
    .map(
      (g) =>
        `<li style="margin-bottom:6px;color:#111827;">${escapeHtml(g.email)}<span style="color:#6b7280;"> · ${escapeHtml(g.created_at ?? "")}</span></li>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:20px;color:#b91c1c;">⚠️ Ghost users detected</h1>
      <p style="margin:0 0 16px;color:#374151;line-height:1.6;">
        ${gap} auth user${gap === 1 ? "" : "s"} have no matching <code>creators</code> row (gap ≥ ${THRESHOLD}). Detected at ${escapeHtml(new Date().toISOString())}.
      </p>
      <p style="margin:0 0 8px;font-weight:600;color:#111827;">Affected emails</p>
      <ul style="margin:0 0 24px;padding-left:20px;">${ghostList || "<li>(none returned)</li>"}</ul>
      <p style="margin:0 0 12px;font-weight:600;color:#111827;">Diagnostic query</p>
      <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:12px;overflow:auto;">${escapeHtml(GHOST_DIAGNOSTIC_SQL)}</pre>
      <p style="margin:16px 0 0;">
        <a href="${sqlEditorUrl}" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Open Supabase SQL editor →</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendAlertEmail(gap: number, ghosts: GhostRow[]) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [ADMIN_EMAIL],
      subject: `[DraftKit] ${gap} ghost user${gap === 1 ? "" : "s"} detected`,
      html: renderAlertHtml(gap, ghosts),
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`resend ${resp.status}: ${err}`);
  }
  return resp.json();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: require shared secret to prevent unauthenticated abuse (cron-only endpoint)
  const providedSecret = req.headers.get("x-internal-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.warn("unauthorized invocation blocked");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }


  try {
    if (!RESEND_API_KEY) {
      console.error("monitor-ghost-users: RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no_resend_key" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Enumerate auth users older than 1 hour (the grace
    //    window: users mid-flow should not count as "ghosts").
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const allUsers: GhostRow[] = [];
    let page = 1;
    const perPage = 1000;
    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      const users = data?.users ?? [];
      for (const u of users) {
        if (!u?.id || !u?.email || !u?.created_at) continue;
        if (u.created_at < cutoff) {
          allUsers.push({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
          });
        }
      }
      if (users.length < perPage) break;
      page += 1;
    }

    // 2. Subtract users with a creators row.
    const { data: creatorRows, error: creatorErr } = await admin
      .from("creators")
      .select("user_id");
    if (creatorErr) throw creatorErr;
    const creatorUserIds = new Set<string>(
      (creatorRows ?? [])
        .map((r: { user_id: string | null }) => r.user_id)
        .filter((v: string | null): v is string => Boolean(v)),
    );
    const ghosts = allUsers.filter((u) => !creatorUserIds.has(u.id));
    const gap = ghosts.length;

    // 3. Pull current alert state.
    const { data: stateRow, error: stateErr } = await admin
      .from("ghost_user_alert_state")
      .select("last_alert_gap")
      .eq("id", true)
      .maybeSingle();
    if (stateErr) throw stateErr;
    const lastAlertGap = stateRow?.last_alert_gap ?? 0;

    const decision = decideAlert(gap, THRESHOLD, lastAlertGap);

    if (decision.shouldAlert) {
      await sendAlertEmail(gap, ghosts);
      await admin
        .from("ghost_user_alert_state")
        .update({
          last_alert_gap: gap,
          last_alert_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
    } else if (decision.shouldReset) {
      await admin
        .from("ghost_user_alert_state")
        .update({
          last_alert_gap: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
    }

    return new Response(
      JSON.stringify({
        gap,
        threshold: THRESHOLD,
        last_alert_gap: lastAlertGap,
        alerted: decision.shouldAlert,
        reset: decision.shouldReset,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    // Per spec: fail silently. Log to Supabase function logs and
    // return 200 so pg_cron doesn't retry-storm us.
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("monitor-ghost-users error:", message);
    return new Response(
      JSON.stringify({ status: "error", error: message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
