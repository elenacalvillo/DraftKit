import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "hello@draftkit.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FeedbackNotificationRequest {
  feedbackType: string;
  message: string;
  rating: number | null;
  email: string | null;
  pageUrl: string | null;
}

const feedbackTypeConfig: Record<string, { emoji: string; color: string; label: string }> = {
  bug: { emoji: "🐛", color: "#dc2626", label: "Bug Report" },
  feature: { emoji: "✨", color: "#7c3aed", label: "Feature Request" },
  general: { emoji: "💬", color: "#2563eb", label: "General Feedback" },
  praise: { emoji: "🎉", color: "#16a34a", label: "Praise" },
};

const generateStarRating = (rating: number | null): string => {
  if (!rating) return "";
  const filled = "★".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Rating</div>
        <div style="font-size: 24px; color: #f59e0b;">${filled}${empty}</div>
      </td>
    </tr>
  `;
};

const generateEmailHtml = (feedback: FeedbackNotificationRequest): string => {
  const config = feedbackTypeConfig[feedback.feedbackType] || feedbackTypeConfig.general;
  
  const replyButton = feedback.email
    ? `
      <tr>
        <td style="padding-top: 24px;">
          <a href="mailto:${feedback.email}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #d9826b 0%, #c9946d 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Reply to ${feedback.email}
          </a>
        </td>
      </tr>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Feedback: ${config.label}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <!-- Header -->
              <tr>
                <td style="background-color: ${config.color}; padding: 24px 40px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 8px;">${config.emoji}</div>
                  <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">${config.label}</h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 32px 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${generateStarRating(feedback.rating)}
                    
                    <!-- Message -->
                    <tr>
                      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Message</div>
                        <div style="font-size: 16px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${feedback.message}</div>
                      </td>
                    </tr>
                    
                    <!-- Page URL -->
                    ${feedback.pageUrl ? `
                    <tr>
                      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Submitted From</div>
                        <div style="font-size: 14px; color: #6b7280;">${feedback.pageUrl}</div>
                      </td>
                    </tr>
                    ` : ""}
                    
                    <!-- User Email -->
                    ${feedback.email ? `
                    <tr>
                      <td style="padding: 16px 0;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">User Email</div>
                        <div style="font-size: 14px; color: #1f2937;">${feedback.email}</div>
                      </td>
                    </tr>
                    ` : `
                    <tr>
                      <td style="padding: 16px 0;">
                        <div style="font-size: 12px; color: #6b7280; font-style: italic;">Anonymous feedback (no email provided)</div>
                      </td>
                    </tr>
                    `}
                    
                    ${replyButton}
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    DraftKit Feedback Notification
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const feedback: FeedbackNotificationRequest = await req.json();

    // Validate required fields
    if (!feedback.feedbackType || !feedback.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = feedbackTypeConfig[feedback.feedbackType] || feedbackTypeConfig.general;
    const subject = `${config.emoji} New ${config.label} on DraftKit`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DraftKit <notifications@draftkit.app>",
        to: [ADMIN_EMAIL],
        subject,
        html: generateEmailHtml(feedback),
        reply_to: feedback.email || undefined,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Resend API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send notification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await emailResponse.json();
    console.log("Feedback notification sent:", result);

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-feedback-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
