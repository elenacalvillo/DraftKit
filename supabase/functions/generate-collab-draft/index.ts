import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSSPost {
  title: string;
  description: string;
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
}

function parseRSS(xml: string): RSSPost[] {
  const posts: RSSPost[] = [];
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
      posts.push({ title, description });
    }
  }

  return posts;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
          newsletter_url
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

    const creatorUrl = request.creators?.substack_url || request.creators?.newsletter_url;
    const requesterUrl = request.requester_substack_url;

    // Fetch posts from both newsletters
    let creatorPosts: RSSPost[] = [];
    let requesterPosts: RSSPost[] = [];

    if (creatorUrl) {
      try {
        const rssUrl = toRSSUrl(creatorUrl);
        const response = await fetch(rssUrl, {
          headers: { "User-Agent": "CollabFlow/1.0" },
        });
        if (response.ok) {
          const xml = await response.text();
          creatorPosts = parseRSS(xml);
        }
      } catch (e) {
        console.error("Failed to fetch creator RSS:", e);
      }
    }

    if (requesterUrl) {
      try {
        const rssUrl = toRSSUrl(requesterUrl);
        const response = await fetch(rssUrl, {
          headers: { "User-Agent": "CollabFlow/1.0" },
        });
        if (response.ok) {
          const xml = await response.text();
          requesterPosts = parseRSS(xml);
        }
      } catch (e) {
        console.error("Failed to fetch requester RSS:", e);
      }
    }

    // Build the prompt for AI
    const creatorName = request.creators?.name || "Creator";
    const requesterName = request.requester_name;
    const collabMessage = request.message || "General collaboration";

    const prompt = `You are helping two newsletter creators plan a collaboration. Generate a detailed collaboration draft.

CREATOR (Host): ${creatorName}
${creatorPosts.length > 0 ? `Recent posts:\n${creatorPosts.map((p, i) => `${i + 1}. "${p.title}": ${p.description}`).join("\n")}` : "No posts available"}

COLLABORATOR (Guest): ${requesterName}
${requesterPosts.length > 0 ? `Recent posts:\n${requesterPosts.map((p, i) => `${i + 1}. "${p.title}": ${p.description}`).join("\n")}` : "No posts available"}

COLLABORATION REQUEST MESSAGE:
"${collabMessage}"

${request.requested_date ? `SCHEDULED DATE: ${request.requested_date}` : "DATE: To be scheduled"}

Generate a collaboration draft that:
1. Creates a compelling title that would work for both audiences
2. Writes an opening hook in the host's writing style (based on their posts)
3. Outlines 4-5 sections with clear ownership (creator, requester, or both)
4. Lists 4-6 talking points they should cover
5. Suggests the best format (interview, co-write, point/counterpoint, etc.)
6. Provides tone notes to help the guest match the host's style
7. Estimates read time`;

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
          { role: "system", content: "You are an expert newsletter collaboration consultant. Generate structured collaboration drafts." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_collab_draft",
              description: "Create a structured collaboration draft for two newsletter creators",
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
                },
                required: ["title", "hook", "outline", "talkingPoints", "suggestedFormat", "toneNotes", "estimatedReadTime"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_collab_draft" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI error:", await aiResponse.text());
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

    // Save the draft to the database
    const { error: updateError } = await supabase
      .from("collab_requests")
      .update({
        ai_draft: draft,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Failed to save draft:", updateError);
    }

    return new Response(
      JSON.stringify({ draft, success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
