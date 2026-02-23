import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSSPost {
  title: string;
  description: string;
  author: string | null;
  pubDate: string | null;
  link: string | null;
}

interface CollabDraft {
  title: string;
  hook: string;
  outline: {
    section: string;
    contributor: "creator" | "requester" | "both";
    description: string;
    suggestedLength: string;
  }[];
  talkingPoints: string[];
  suggestedFormat: string;
  toneNotes: string;
  estimatedReadTime: string;
  sourcesUsed?: {
    creatorArticles: string[];
    requesterArticles: string[];
    keyInsightsExtracted: string[];
  };
}

// Extract feed-level author from RSS XML
function extractFeedAuthor(xml: string): string | null {
  const patterns = [
    /<channel>[\s\S]*?<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/,
    /<channel>[\s\S]*?<dc:creator>(.*?)<\/dc:creator>/,
    /<channel>[\s\S]*?<author>(.*?)<\/author>/,
    /<channel>[\s\S]*?<webMaster>(.*?)<\/webMaster>/,
    /<channel>[\s\S]*?<managingEditor>(.*?)<\/managingEditor>/,
  ];
  
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function parseRSS(xml: string): { posts: RSSPost[]; feedAuthor: string | null } {
  const posts: RSSPost[] = [];
  const feedAuthor = extractFeedAuthor(xml);
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && posts.length < 5) {
    const item = match[1];
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);

    if (titleMatch && descMatch) {
      const title = titleMatch[1] || titleMatch[2] || "";
      let description = descMatch[1] || descMatch[2] || "";
      description = description.replace(/<[^>]*>/g, "").trim();
      if (description.length > 500) {
        description = description.substring(0, 500) + "...";
      }
      
      // Extract item-level author (falls back to feed author)
      const authorMatch = item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/) ||
                          item.match(/<dc:creator>(.*?)<\/dc:creator>/) ||
                          item.match(/<author>(.*?)<\/author>/);
      const author = authorMatch ? authorMatch[1].trim() : feedAuthor;
      
      // Extract publication date
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : null;
      
      // Extract link
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const link = linkMatch ? linkMatch[1].trim() : null;
      
      posts.push({ title, description, author, pubDate, link });
    }
  }

  return { posts, feedAuthor };
}

// Normalize a name for comparison
function normalizeName(name: string | null): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Filter posts to only include those by the expected author
function filterByAuthor(posts: RSSPost[], expectedAuthor: string | null): RSSPost[] {
  if (!expectedAuthor || !posts.some(p => p.author)) {
    return posts;
  }
  
  const normalizedExpected = normalizeName(expectedAuthor);
  
  const filtered = posts.filter(p => {
    if (!p.author) return true;
    const normalizedAuthor = normalizeName(p.author);
    return normalizedAuthor.includes(normalizedExpected) || 
           normalizedExpected.includes(normalizedAuthor);
  });
  
  if (filtered.length < 2 && posts.length >= 2) {
    console.log(`Author filtering too aggressive, keeping all ${posts.length} posts`);
    return posts;
  }
  
  console.log(`Filtered from ${posts.length} to ${filtered.length} posts by author: ${expectedAuthor}`);
  return filtered;
}

// Security constants for RSS fetching
const RSS_FETCH_TIMEOUT_MS = 15000; // 15 second timeout
const RSS_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB max
const RSS_MAX_PARSE_LENGTH = 500 * 1024; // 500KB for regex parsing to prevent ReDoS

// SSRF Protection: Validate URL is a safe Substack domain
function isAllowedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Only allow HTTPS
    if (urlObj.protocol !== "https:") {
      console.warn(`SSRF blocked: non-HTTPS protocol: ${urlObj.protocol}`);
      return false;
    }
    
    // Block localhost and private IPs
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local / AWS metadata
      /^0\./, 
      /^\[::1\]$/,
      /^\[fd/i, // IPv6 private
      /^\[fe80:/i, // IPv6 link-local
    ];
    
    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        console.warn(`SSRF blocked: private/local address: ${hostname}`);
        return false;
      }
    }
    
    // Allowlist: Only Substack domains
    if (hostname.endsWith(".substack.com") || hostname === "substack.com") {
      return true;
    }
    
    console.warn(`SSRF blocked: non-Substack domain: ${hostname}. Only *.substack.com domains are allowed.`);
    return false;
  } catch (e) {
    console.warn(`SSRF blocked: invalid URL: ${url}`);
    return false;
  }
}

// Fetch RSS with timeout, size limit, and SSRF protection
async function fetchRSSWithLimits(url: string): Promise<{ ok: boolean; text: string; error?: string }> {
  // SSRF check first
  if (!isAllowedDomain(url)) {
    return { ok: false, text: "", error: "URL not allowed. Only Substack domains (*.substack.com) are supported." };
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { 
      headers: { "User-Agent": "DraftKit/1.0" },
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { ok: false, text: "", error: `HTTP ${response.status}` };
    }
    
    // Check content-length header first
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > RSS_MAX_SIZE_BYTES) {
      return { ok: false, text: "", error: "Response too large" };
    }
    
    // Stream response and enforce size limit
    const reader = response.body?.getReader();
    if (!reader) {
      return { ok: false, text: "", error: "No response body" };
    }
    
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > RSS_MAX_SIZE_BYTES) {
        reader.cancel();
        return { ok: false, text: "", error: "Response too large" };
      }
      
      chunks.push(value);
    }
    
    const decoder = new TextDecoder();
    let text = chunks.map(chunk => decoder.decode(chunk, { stream: true })).join("");
    
    // Limit parsing length to prevent ReDoS
    if (text.length > RSS_MAX_PARSE_LENGTH) {
      console.log(`Truncating RSS from ${text.length} to ${RSS_MAX_PARSE_LENGTH} chars for safe parsing`);
      text = text.substring(0, RSS_MAX_PARSE_LENGTH);
    }
    
    return { ok: true, text };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, text: "", error: "Request timeout" };
    }
    return { ok: false, text: "", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function toRSSUrl(substackUrl: string): string {
  let url = substackUrl.trim();
  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.endsWith(".substack.com")) {
      return `https://${hostname}/feed`;
    }

    if (hostname === "substack.com") {
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts[0] === "@") {
        const username = pathParts[1];
        return `https://${username}.substack.com/feed`;
      }
    }

    return `https://${hostname}/feed`;
  } catch {
    if (!url.includes(".")) {
      return `https://${url}.substack.com/feed`;
    }
    return url.endsWith("/feed") ? url : `${url}/feed`;
  }
}

// Convert structured AI draft into semantic HTML for the workspace
function draftToHtml(draft: CollabDraft, creatorName: string, requesterName: string): string {
  const parts: string[] = [];

  if (draft.title) {
    parts.push(`<h1>${escapeHtml(draft.title)}</h1>`);
  }

  if (draft.hook) {
    parts.push(`<p>${escapeHtml(draft.hook)}</p>`);
  }

  if (draft.outline?.length) {
    for (const section of draft.outline) {
      const contributor = section.contributor === "creator"
        ? creatorName
        : section.contributor === "requester"
        ? requesterName
        : `${creatorName} & ${requesterName}`;
      parts.push(`<h2>${escapeHtml(section.section)}</h2>`);
      parts.push(`<p>${escapeHtml(section.description)} <em>(${escapeHtml(contributor)} · ${escapeHtml(section.suggestedLength)})</em></p>`);
    }
  }

  if (draft.talkingPoints?.length) {
    parts.push(`<h2>Talking Points</h2>`);
    parts.push(`<ul>${draft.talkingPoints.map(tp => `<li>${escapeHtml(tp)}</li>`).join("")}</ul>`);
  }

  if (draft.toneNotes) {
    parts.push(`<p><em>Tone: ${escapeHtml(draft.toneNotes)}</em></p>`);
  }

  return parts.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AUTHENTICATION CHECK ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace("Bearer ", "");

    // Create client with persistSession: false for edge function context
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Pass the token directly to getUser() for validation
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    // --- END AUTHENTICATION CHECK ---

    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the collaboration request with creator info
    const { data: request, error: requestError } = await supabase
      .from("collab_requests")
      .select(`
        *,
        creators (
          id,
          name,
          substack_url,
          newsletter_url,
          user_id,
          collab_guidelines
        )
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- AUTHORIZATION CHECK ---
    // Only the creator who owns the request can generate drafts
    const creatorUserId = request.creators?.user_id;
    if (creatorUserId !== userId) {
      console.error(`Unauthorized: user ${userId} tried to access request owned by ${creatorUserId}`);
      return new Response(
        JSON.stringify({ error: "You do not have permission to generate drafts for this request" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- END AUTHORIZATION CHECK ---

    const creatorUrl = request.creators?.substack_url || request.creators?.newsletter_url;
    const requesterUrl = request.requester_substack_url;
    const creatorName = request.creators?.name || "Creator";
    const requesterName = request.requester_name;

    // Fetch posts from both newsletters with author filtering and security limits
    let creatorPosts: RSSPost[] = [];
    let requesterPosts: RSSPost[] = [];
    let creatorFeedAuthor: string | null = null;
    let requesterFeedAuthor: string | null = null;

    if (creatorUrl) {
      try {
        const rssUrl = toRSSUrl(creatorUrl);
        const result = await fetchRSSWithLimits(rssUrl);
        if (result.ok) {
          const parsed = parseRSS(result.text);
          creatorFeedAuthor = parsed.feedAuthor;
          creatorPosts = filterByAuthor(parsed.posts, parsed.feedAuthor);
          console.log(`Creator posts: ${creatorPosts.length} (author: ${creatorFeedAuthor})`);
        } else {
          console.error(`Failed to fetch creator RSS: ${result.error}`);
        }
      } catch (e) {
        console.error("Failed to fetch creator RSS:", e);
      }
    }

    if (requesterUrl) {
      try {
        const rssUrl = toRSSUrl(requesterUrl);
        const result = await fetchRSSWithLimits(rssUrl);
        if (result.ok) {
          const parsed = parseRSS(result.text);
          requesterFeedAuthor = parsed.feedAuthor;
          requesterPosts = filterByAuthor(parsed.posts, parsed.feedAuthor);
          console.log(`Requester posts: ${requesterPosts.length} (author: ${requesterFeedAuthor})`);
        } else {
          console.error(`Failed to fetch requester RSS: ${result.error}`);
        }
      } catch (e) {
        console.error("Failed to fetch requester RSS:", e);
      }
    }

    // Build the prompt for AI with author attribution
    const collabMessage = request.message || "General collaboration";
    const selectedCollabType = request.selected_collab_type || "General";
    const hostGuidelines = request.creators?.collab_guidelines || "";

    // Get collab-type-specific instructions
    const getCollabTypeInstructions = (type: string): string => {
      switch (type) {
        case "Virtual Coffee":
        case "Live Event / Webinar":
          return `OUTPUT FORMAT: Conversation/Event Agenda
- Generate a structured agenda with talking points and ice-breakers
- Include timing suggestions for each section
- Add audience engagement ideas if applicable
- Suggest pre-event preparation for both parties`;
        case "Guest Post Exchange":
        case "Async Drafting":
          return `OUTPUT FORMAT: Article Draft Structure  
- Generate a full article outline with section headers
- Assign clear ownership (host/guest) for each section
- Include opening hook written in host's voice
- Add suggested word counts per section`;
        case "Co-written Article":
          return `OUTPUT FORMAT: Collaborative Writing Plan
- Create shared outline with alternating sections
- Define clear handoff points between writers
- Include style guide notes for consistency
- Suggest a timeline for drafts and revisions`;
        case "Interview Style":
          return `OUTPUT FORMAT: Q&A Framework
- Generate 8-10 interview questions
- Include follow-up prompts for each question
- Add narrative arc suggestions
- Note key quotes to extract for headlines`;
        case "Newsletter Shoutout":
          return `OUTPUT FORMAT: Recommendation Package
- Generate compelling blurb templates (3 lengths: short/medium/long)
- List key selling points to highlight
- Include CTA suggestions
- Add context for why subscribers should care`;
        default:
          return `OUTPUT FORMAT: Flexible Collaboration Draft
- Generate an outline appropriate for the collaboration type
- Include clear sections with assigned contributors
- Add talking points and next steps`;
      }
    };

    const collabTypeInstructions = getCollabTypeInstructions(selectedCollabType);

    const prompt = `You are helping two newsletter creators plan a collaboration. Generate a detailed collaboration draft.

COLLABORATION TYPE: ${selectedCollabType}
${collabTypeInstructions}

${hostGuidelines ? `HOST'S COLLABORATION GUIDELINES:\n${hostGuidelines}\n\nIMPORTANT: Respect these guidelines in your output.\n` : ""}

CRITICAL: The COLLABORATION REQUEST MESSAGE below is the PRIMARY DIRECTION for this draft. The requester has already proposed specific topics, formats, or ideas. Your draft MUST directly incorporate their suggestions:
- If they proposed a specific topic/title → Use it as the basis for the collaboration title
- If they suggested a format (interview, essay, crossover, etc.) → Use their suggested format exactly
- If they outlined themes or angles → Structure the outline around their themes
- If they described roles for each person → Honor those role assignments

Do NOT ignore, heavily reinterpret, or replace their ideas with your own. BUILD UPON their suggestions using the article context below.

IMPORTANT: Only use articles ACTUALLY WRITTEN BY each person. Ignore guest posts or collaborations from other authors.

CREATOR (Host): ${creatorName} ${creatorFeedAuthor ? `(Feed Owner: ${creatorFeedAuthor})` : ""}
${creatorPosts.length > 0 ? `Recent posts:\n${creatorPosts.map((p, i) => `${i + 1}. "${p.title}"${p.author ? ` [by ${p.author}]` : ""}: ${p.description}`).join("\n")}` : "No posts available"}

COLLABORATOR (Guest): ${requesterName} ${requesterFeedAuthor ? `(Feed Owner: ${requesterFeedAuthor})` : ""}
${requesterPosts.length > 0 ? `Recent posts:\n${requesterPosts.map((p, i) => `${i + 1}. "${p.title}"${p.author ? ` [by ${p.author}]` : ""}: ${p.description}`).join("\n")}` : "No posts available"}

===== COLLABORATION REQUEST MESSAGE (PRIMARY DIRECTION - FOLLOW THIS CLOSELY) =====
"${collabMessage}"
==================================================================================

${request.requested_date ? `SCHEDULED DATE: ${request.requested_date}` : "DATE: To be scheduled"}

Generate a collaboration draft that:
1. Uses the requester's proposed topic/title as the foundation (adapt but don't replace it)
2. Follows the OUTPUT FORMAT specified above for the "${selectedCollabType}" collaboration type
3. Writes an opening hook in the host's writing style (based on their posts)
4. Outlines 4-5 sections following the requester's suggested structure/themes if provided
5. Lists 4-6 talking points that align with the requester's proposed angles
6. Provides tone notes to help the guest match the host's style
7. Estimates read time
8. Lists which specific articles you used to inform the draft`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert newsletter collaboration consultant. Generate structured collaboration drafts. Always cite which articles informed your suggestions." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_collab_draft",
              description: "Create a structured collaboration draft for two newsletter creators with source attribution",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Compelling title for the collaboration piece" },
                  hook: { type: "string", description: "Opening paragraph written in the host's voice/style" },
                  outline: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        section: { type: "string", description: "Section title" },
                        contributor: { type: "string", enum: ["creator", "requester", "both"], description: "Who writes this section" },
                        description: { type: "string", description: "What this section covers" },
                        suggestedLength: { type: "string", description: "Suggested word count or time" },
                      },
                      required: ["section", "contributor", "description", "suggestedLength"],
                    },
                    description: "Outline of 4-5 sections",
                  },
                  talkingPoints: {
                    type: "array",
                    items: { type: "string" },
                    description: "4-6 key talking points to cover",
                  },
                  suggestedFormat: { type: "string", description: "Recommended format (interview, co-write, etc.)" },
                  toneNotes: { type: "string", description: "Notes to help the guest match the host's writing style" },
                  estimatedReadTime: { type: "string", description: "Estimated read time for the final piece" },
                  sourcesUsed: {
                    type: "object",
                    properties: {
                      creatorArticles: {
                        type: "array",
                        items: { type: "string" },
                        description: "Titles of creator's articles used to inform the draft",
                      },
                      requesterArticles: {
                        type: "array",
                        items: { type: "string" },
                        description: "Titles of requester's articles used to inform the draft",
                      },
                      keyInsightsExtracted: {
                        type: "array",
                        items: { type: "string" },
                        description: "Key insights extracted from the articles that shaped the draft",
                      },
                    },
                    required: ["creatorArticles", "requesterArticles", "keyInsightsExtracted"],
                    additionalProperties: false,
                    description: "Source articles used to generate the draft for transparency",
                  },
                },
                required: ["title", "hook", "outline", "talkingPoints", "suggestedFormat", "toneNotes", "estimatedReadTime", "sourcesUsed"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_collab_draft" } },
      }),
    });

    if (!aiResponse.ok) {
      // Log detailed error server-side, return generic message to client
      const errorText = await aiResponse.text();
      console.error("AI service error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate draft" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const draft: CollabDraft = JSON.parse(toolCall.function.arguments);

    // Convert draft to HTML for the shared workspace
    const sharedContentHtml = draftToHtml(draft, creatorName, requesterName);

    // Safety lock: check if a human has already edited shared_content
    const hasHumanContent = request.shared_content &&
      request.shared_content.trim().length > 0 &&
      request.content_last_edited_by &&
      request.content_last_edited_by !== "AI Draft";

    // Build the update payload — only overwrite shared_content if no human edits exist
    const updatePayload: Record<string, unknown> = {
      ai_draft: draft,
      approved_at: new Date().toISOString(),
    };

    if (!hasHumanContent) {
      updatePayload.shared_content = sharedContentHtml;
      updatePayload.content_last_edited_by = "AI Draft";
      updatePayload.content_last_edited_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("collab_requests")
      .update(updatePayload)
      .eq("id", requestId);

    if (updateError) {
      console.error("Failed to save draft:", updateError);
    }

    return new Response(
      JSON.stringify({
        draft,
        shared_content: hasHumanContent ? null : sharedContentHtml,
        human_content_preserved: !!hasHumanContent,
        success: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
