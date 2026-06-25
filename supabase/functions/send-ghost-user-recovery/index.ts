// =============================================================
// send-ghost-user-recovery
//
// Finds auth users that have no matching public.creators row
// ("ghost users") and emails them a single reminder with a link
// back to /signup so they can resume Step 2.
//
// Behaviour:
//   * Uses the service-role key so it can read auth.users (the
//     anon key cannot).
//   * Skips internal / test addresses (currently
//     `abi@rezonant.app`).
//   * Deduplicates against public.recovery_emails_sent — each
//     ghost user is reminded exactly once.
//   * If Resend fails for an individual ghost user, the failure
//     is logged and the batch continues.
//
// Invocation: POST {} (no body required). Returns a small JSON
// summary so the admin can confirm the run.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://draftkit.app";
const FROM_ADDRESS =
  Deno.env.get("RECOVERY_FROM_ADDRESS") ??
  "DraftKit <hello@draftkit.app>";

// Internal / test addresses we never email. Lower-cased once
// here so the runtime comparison is allocation-free.
const EXCLUDED_EMAILS = new Set<string>([
  "abi@rezonant.app",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const RECOVERY_SUBJECT =
  "Your DraftKit account is ready — finish setting it up";

// Exported as plain-text so tests can pin the approved copy and so
// a later "AI variant" change doesn't accidentally drift away from
// the wording approved by the team.
export const RECOVERY_BODY_TEXT = (completeUrl: string) => `Hey,

You created a DraftKit account but didn't get a chance to finish your profile — and that's okay, we held your spot.

Your account just needs a few details: a display name, your newsletter link, and how you like to collaborate. It takes about 2 minutes.

Complete your profile → ${completeUrl}

Once you're set up, you'll have a public booking page that other Substack writers can find and send collaboration requests to.

Questions? Just reply here.

— The DraftKit team`;

const renderRecoveryHtml = (completeUrl: string): string => `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
    <tr><td>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hey,</p>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">
        You created a DraftKit account but didn't get a chance to finish your profile — and that's okay, we held your spot.
      </p>
      <p style="margin:0 0 24px;font-size:16px;color:#111827;line-height:1.6;">
        Your account just needs a few details: a display name, your newsletter link, and how you like to collaborate. It takes about 2 minutes.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(completeUrl)}" style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#d9826b 0%,#c9946d 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Complete your profile →</a>
      </p>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">
        Once you're set up, you'll have a public booking page that other Substack writers can find and send collaboration requests to.
      </p>
      <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">
        Questions? Just reply here.
      </p>
      <p style="margin:32px 0 0;font-size:16px;color:#6b7280;">— The DraftKit team</p>
    </td></tr>
  </table>
</body></html>`;

interface GhostUser {
  id: string;
  email: string;
}

/**
 * Pulled out as an exported helper so unit tests can pin down the
 * exclusion + dedup logic without spinning up Supabase.
 */
export function filterGhostUsers(
  ghosts: ReadonlyArray<GhostUser>,
  alreadySent: ReadonlySet<string>,
  excluded: ReadonlySet<string> = EXCLUDED_EMAILS,
): GhostUser[] {
  return ghosts.filter((g) => {
    if (!g.email) return false;
    const normalized = g.email.trim().toLowerCase();
    if (excluded.has(normalized)) return false;
    if (alreadySent.has(g.id)) return false;
    return true;
  });
}

async function sendRecoveryEmail(to: string, completeUrl: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: RECOVERY_SUBJECT,
      html: renderRecoveryHtml(completeUrl),
      text: RECOVERY_BODY_TEXT(completeUrl),
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

  // Restrict to scheduled cron / admin invocations only. Without this
  // gate, any caller could trigger a mass-email blast to ghost users.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-internal-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Enumerate auth users. listUsers is paginated; we page
    //    until we've seen every account. The site is small enough
    //    that a single batch easily covers it, but we keep the
    //    pagination loop for safety.
    const allUsers: { id: string; email: string }[] = [];
    let page = 1;
    const perPage = 1000;
    // Cap pages defensively to keep the function bounded.
    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      const users = data?.users ?? [];
      for (const u of users) {
        if (u?.id && u?.email) {
          allUsers.push({ id: u.id, email: u.email });
        }
      }
      if (users.length < perPage) break;
      page += 1;
    }

    // 2. A user is a "ghost" if they have no creators row, OR
    //    their creators row is an empty placeholder (no
    //    substack_url, no newsletter_url, and no creator_contacts
    //    entry). The 18 ghosts that were manually backfilled into
    //    `creators` to fix the count fall into the second bucket.
    const { data: creatorRows, error: creatorErr } = await admin
      .from("creators")
      .select("id, user_id, substack_url, newsletter_url");
    if (creatorErr) throw creatorErr;

    const { data: contactRows, error: contactErr } = await admin
      .from("creator_contacts")
      .select("creator_id");
    if (contactErr) throw contactErr;
    const contactCreatorIds = new Set<string>(
      (contactRows ?? [])
        .map((r: { creator_id: string | null }) => r.creator_id)
        .filter((v: string | null): v is string => Boolean(v)),
    );

    const completeUserIds = new Set<string>();
    for (const c of creatorRows ?? []) {
      const row = c as {
        id: string;
        user_id: string | null;
        substack_url: string | null;
        newsletter_url: string | null;
      };
      if (!row.user_id) continue;
      const hasUrl = Boolean(
        (row.substack_url && row.substack_url.trim()) ||
          (row.newsletter_url && row.newsletter_url.trim()),
      );
      const hasContact = contactCreatorIds.has(row.id);
      if (hasUrl || hasContact) {
        completeUserIds.add(row.user_id);
      }
    }

    const ghosts: GhostUser[] = allUsers.filter(
      (u) => !completeUserIds.has(u.id),
    );

    // 3. Subtract users we've already reminded.
    const { data: sentRows, error: sentErr } = await admin
      .from("recovery_emails_sent")
      .select("user_id");
    if (sentErr) throw sentErr;
    const alreadySent = new Set<string>(
      (sentRows ?? []).map((r: { user_id: string }) => r.user_id),
    );

    const toEmail = filterGhostUsers(ghosts, alreadySent);

    // 4. Send + log, continuing past individual failures.
    const completeUrl = `${APP_URL}/signup`;
    const results: Array<
      { user_id: string; email: string; status: "sent" | "failed"; error?: string }
    > = [];
    for (const ghost of toEmail) {
      try {
        await sendRecoveryEmail(ghost.email, completeUrl);
        const { error: logErr } = await admin
          .from("recovery_emails_sent")
          .insert({ user_id: ghost.id, email: ghost.email })
          .select()
          .single();
        if (logErr && !String(logErr.message).includes("duplicate")) {
          console.error("recovery: failed to log send", ghost.email, logErr);
        }
        results.push({
          user_id: ghost.id,
          email: ghost.email,
          status: "sent",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        console.error("recovery: send failed for", ghost.email, message);
        results.push({
          user_id: ghost.id,
          email: ghost.email,
          status: "failed",
          error: message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ghost_count: ghosts.length,
        eligible_count: toEmail.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("send-ghost-user-recovery error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
