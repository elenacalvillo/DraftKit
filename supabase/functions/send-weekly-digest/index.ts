import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AUDIENCE_ID = "84fa3259-a54a-4c06-9493-e0bd9d720fd0";
const GITHUB_REPO = "elenacalvillo/DraftKit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Conventional commit prefixes to ignore
const NOISE_PREFIXES = /^(chore|refactor|test|deps|ci|build|style|docs)\s*[:(]/i;
const TRIVIAL_MSG = /^(update|fix|merge|wip|minor|bump)$/i;

interface Bullet {
  title: string;
  body: string;
}

interface DigestOutput {
  subject: string;
  bullets: Bullet[];
}

async function fetchCommits(): Promise<string[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?since=${since}&per_page=100`;

  const resp = await fetch(url, {
    headers: { "User-Agent": "DraftKit-Digest" },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API error ${resp.status}: ${text}`);
  }

  const commits = await resp.json();
  return commits.map((c: any) => c.commit?.message || "").filter(Boolean);
}

function filterCommits(messages: string[]): string[] {
  return messages.filter((msg) => {
    const firstLine = msg.split("\n")[0].trim();
    // Drop noise prefixes
    if (NOISE_PREFIXES.test(firstLine)) return false;
    // Drop merge commits
    if (firstLine.toLowerCase().startsWith("merge ")) return false;
    // Drop trivial messages (< 10 chars or generic words)
    if (firstLine.length < 10) return false;
    if (TRIVIAL_MSG.test(firstLine)) return false;
    return true;
  });
}

async function transformWithAI(commits: string[]): Promise<DigestOutput> {
  const commitList = commits.map((c) => `- ${c.split("\n")[0]}`).join("\n");

  const systemPrompt = `You are Elena, PM of DraftKit. Your job is to turn technical git commits into a "What's New" email with exactly 3 bullet points.

Rules:
- Transform, don't summarize. Focus on the "Superpower" — tell the user what they can do now.
- Tone: natural, punchy, no jargon.
- NEVER use: "delve", "unlock", "harness", "leverage", "empower", "streamline", "cutting-edge", "game-changer", "best-in-class", em dashes, or exclamation marks in headers.
- If a commit is a bug fix, explain why the user's life is easier now.
- Each bullet: bold title (6 words max), then 1-2 sentence explanation.
- Also generate a punchy email subject line (under 50 chars).
- Do not invent features or benefits. If a commit message is ambiguous, ignore it. Use only the provided text as the source of truth.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here are this week's commits:\n${commitList}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "format_digest",
            description: "Format the weekly digest email content.",
            parameters: {
              type: "object",
              properties: {
                subject: {
                  type: "string",
                  description: "Email subject line, under 50 characters",
                },
                bullets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Bold title, 6 words max",
                      },
                      body: {
                        type: "string",
                        description: "1-2 sentence explanation",
                      },
                    },
                    required: ["title", "body"],
                    additionalProperties: false,
                  },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["subject", "bullets"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "format_digest" } },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI Gateway error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("AI did not return structured output");
  }

  return JSON.parse(toolCall.function.arguments) as DigestOutput;
}

function buildEmailHtml(digest: DigestOutput): string {
  const bulletRows = digest.bullets
    .map(
      (b) => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #f0f0f0;">
            <div style="font-weight: 700; color: #1a1a1a; margin-bottom: 6px; font-size: 16px;">${b.title}</div>
            <div style="color: #555555; font-size: 15px; line-height: 1.5;">${b.body}</div>
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${digest.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">Draft</span><span style="font-size: 22px; font-weight: 700; color: #e07b6c; letter-spacing: -0.5px;">Kit</span>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">The engine for creators who ship together</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Here's what changed in your Writer's Room this week:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                ${bulletRows}
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #d9826b 0%, #c9946d 100%);">
                    <a href="https://draftkit.app/dashboard" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Open Your Writer's Room →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Have questions or ideas? Just reply to this email.
              </p>
              <p style="margin: 24px 0 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Elena<br>
                <span style="color: #666666; font-size: 14px;">Founder, DraftKit</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                You're receiving this because you're part of the DraftKit community.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendBroadcast(digest: DigestOutput): Promise<any> {
  const html = buildEmailHtml(digest);

  // Step 1: Create broadcast
  const createResp = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audience_id: AUDIENCE_ID,
      from: "DraftKit <hello@draftkit.app>",
      subject: digest.subject,
      html,
      name: `Weekly Digest ${new Date().toISOString().slice(0, 10)}`,
    }),
  });

  if (!createResp.ok) {
    const text = await createResp.text();
    throw new Error(`Resend create broadcast error ${createResp.status}: ${text}`);
  }

  const broadcast = await createResp.json();
  const broadcastId = broadcast.id;

  // Step 2: Send broadcast
  const sendResp = await fetch(
    `https://api.resend.com/broadcasts/${broadcastId}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!sendResp.ok) {
    const text = await sendResp.text();
    throw new Error(`Resend send broadcast error ${sendResp.status}: ${text}`);
  }

  return sendResp.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting weekly digest...");

    // Step 1: Fetch commits
    const allCommits = await fetchCommits();
    console.log(`Fetched ${allCommits.length} commits from GitHub`);

    // Step 2: Filter noise
    const meaningful = filterCommits(allCommits);
    console.log(`${meaningful.length} meaningful commits after filtering`);

    // Step 3: Threshold check
    if (meaningful.length < 2) {
      console.log("Skipping: insufficient signal");
      return new Response(
        JSON.stringify({ skipped: true, reason: "insufficient signal", commitCount: meaningful.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: AI transformation
    const digest = await transformWithAI(meaningful);
    console.log(`AI generated subject: "${digest.subject}"`);

    // Step 5: Send broadcast
    const result = await sendBroadcast(digest);
    console.log("Broadcast sent:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, subject: digest.subject, broadcastResult: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly digest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
