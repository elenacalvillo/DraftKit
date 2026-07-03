import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DraftKit <hello@draftkit.app>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Feature {
  title: string;
  description: string;
}

interface ReleaseNotesRequest {
  subject: string;
  features: Feature[];
  previewOnly?: boolean;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const generateEmailHtml = (
  creatorName: string,
  subject: string,
  features: Feature[]
): string => {
  const featuresList = features
    .map(
      (f) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${escapeHtml(f.title)}</div>
            <div style="color: #666666; font-size: 14px;">${escapeHtml(f.description)}</div>
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <!-- Header with brand wordmark -->
              <tr>
                <td style="background: #ffffff; padding: 32px 40px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                  <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">Draft</span><span style="font-size: 22px; font-weight: 700; color: #e07b6c; letter-spacing: -0.5px;">Kit</span>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">The engine for creators who ship together</p>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                    Hi ${escapeHtml(creatorName)},
                  </p>
                  
                  <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                    Thank you for being one of our <strong>founding creators</strong>. Your early feedback has shaped DraftKit into what it is today. Here's what's new:
                  </p>
                  
                  <!-- Features list -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                    ${featuresList}
                  </table>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                    <tr>
                      <td style="border-radius: 8px; background: linear-gradient(135deg, #d9826b 0%, #c9946d 100%);">
                        <a href="https://collabstack.lovable.app/dashboard" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                          Explore Your Dashboard →
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 24px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    Have questions or ideas? Just reply to this email – I read every message.
                  </p>
                  
                  <p style="margin: 24px 0 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                    – Elena<br>
                    <span style="color: #666666; font-size: 14px;">Founder, DraftKit</span>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    You're receiving this because you're a founding member of DraftKit.<br>
                    Thank you for being part of our creator community.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

function extractCreatorEmail(creatorRow: any): string | null {
  const cc = creatorRow?.creator_contacts;
  if (!cc) return null;
  if (Array.isArray(cc)) return cc[0]?.email ?? null;
  return cc.email ?? null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's token to check admin role
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user using getUser
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await supabaseUser.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { subject, features, previewOnly }: ReleaseNotesRequest = await req.json();

    if (!subject || !features || features.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subject, features" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role client to query user_roles and creators
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pro users with their creator info
    const { data: proUsers, error: usersError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "pro");

    if (usersError) {
      console.error("Error fetching pro users:", usersError);
      return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!proUsers || proUsers.length === 0) {
      return new Response(JSON.stringify({ error: "No pro users found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get creator details for these users
    const userIds = proUsers.map((u) => u.user_id);
    const { data: creators, error: creatorsError } = await supabaseAdmin
      .from("creators")
      .select("user_id, name, creator_contacts(email)")
      .in("user_id", userIds);

    if (creatorsError) {
      console.error("Error fetching creators:", creatorsError);
      return new Response(JSON.stringify({ error: "Failed to fetch creator details" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preview mode - return what would be sent
    if (previewOnly) {
      return new Response(
        JSON.stringify({
          previewMode: true,
          recipientCount: creators?.length || 0,
          recipients: creators?.map((c: any) => ({
            name: c.name,
            email: extractCreatorEmail(c),
          })),
          sampleHtml: generateEmailHtml(
            creators?.[0]?.name || "Creator",
            subject,
            features
          ),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send emails with rate limiting (100ms delay between sends)
    const results: { email: string; status: string; error?: string }[] = [];

    for (const creator of creators || []) {
      try {
        const email = extractCreatorEmail(creator);
        if (!email) {
          results.push({ email: "", status: "failed", error: "Missing recipient email" });
          continue;
        }

        const html = generateEmailHtml(creator.name, subject, features);

        const emailResponse = await sendEmail(email, subject, html);

        // Log to email_events
        await supabaseAdmin.from("email_events").insert({
          request_id: crypto.randomUUID(), // Use a unique ID for release notes
          type: "release_notes",
          to_email: email,
          status: "sent",
          provider_id: emailResponse?.id || null,
        });

        results.push({ email, status: "sent" });

        // Rate limiting - wait 100ms between sends
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const email = extractCreatorEmail(creator) || "";
        console.error(`Failed to send to ${email}:`, error);
        results.push({
          email,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.status === "sent").length;
    const failCount = results.filter((r) => r.status === "failed").length;

    console.log(`Release notes sent: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-release-notes:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
