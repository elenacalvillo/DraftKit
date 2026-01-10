import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSSPost {
  title: string;
  description: string;
}

interface CollabSuggestion {
  topic: string;
  description: string;
  format: string;
  whyItWorks: string;
}

// Parse RSS XML and extract post titles and descriptions
function parseRSS(xml: string): RSSPost[] {
  const posts: RSSPost[] = [];
  
  // Extract items using regex (Deno edge runtime doesn't have DOMParser for XML)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/;
  const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/;
  
  let match;
  while ((match = itemRegex.exec(xml)) !== null && posts.length < 10) {
    const item = match[1];
    const titleMatch = item.match(titleRegex);
    const descMatch = item.match(descRegex);
    
    const title = titleMatch ? (titleMatch[1] || titleMatch[2] || "").trim() : "";
    let description = descMatch ? (descMatch[1] || descMatch[2] || "").trim() : "";
    
    // Strip HTML tags from description
    description = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    // Limit description length
    if (description.length > 500) {
      description = description.substring(0, 500) + "...";
    }
    
    if (title) {
      posts.push({ title, description });
    }
  }
  
  return posts;
}

// Convert Substack URL to RSS feed URL
// Handles both profile format (substack.com/@username) and newsletter format (username.substack.com)
function toRSSUrl(substackUrl: string): string {
  let url = substackUrl.trim();
  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  
  // Handle profile format: substack.com/@username or www.substack.com/@username
  const profileMatch = url.match(/(?:www\.)?substack\.com\/@([a-zA-Z0-9_-]+)/i);
  if (profileMatch) {
    // Convert to newsletter format
    url = `https://${profileMatch[1]}.substack.com`;
    console.log(`Converted profile URL to newsletter format: ${url}`);
  }
  
  // Handle cases where user entered just the username part
  if (!url.includes('.') && !url.includes('/')) {
    url = `https://${url}.substack.com`;
    console.log(`Converted username to newsletter format: ${url}`);
  }
  
  // Ensure https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Add /feed if not present
  if (!url.endsWith("/feed")) {
    url = url + "/feed";
  }
  return url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { creatorSubstackUrl, visitorSubstackUrl } = await req.json();

    if (!creatorSubstackUrl || !visitorSubstackUrl) {
      return new Response(
        JSON.stringify({ error: "Both Substack URLs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch both RSS feeds in parallel
    const [creatorRSSUrl, visitorRSSUrl] = [
      toRSSUrl(creatorSubstackUrl),
      toRSSUrl(visitorSubstackUrl),
    ];

    console.log("Fetching RSS feeds:", { creatorRSSUrl, visitorRSSUrl });

    const [creatorResponse, visitorResponse] = await Promise.all([
      fetch(creatorRSSUrl, { headers: { "User-Agent": "CollabFlow/1.0" } }),
      fetch(visitorRSSUrl, { headers: { "User-Agent": "CollabFlow/1.0" } }),
    ]);

    if (!creatorResponse.ok) {
      console.error(`Creator RSS fetch failed: ${creatorResponse.status} for URL: ${creatorRSSUrl}`);
      return new Response(
        JSON.stringify({ 
          error: `Could not fetch creator's Substack (${creatorResponse.status}). The URL format should be like "username.substack.com". Profile URLs like "substack.com/@username" are also supported.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!visitorResponse.ok) {
      console.error(`Visitor RSS fetch failed: ${visitorResponse.status} for URL: ${visitorRSSUrl}`);
      return new Response(
        JSON.stringify({ 
          error: `Could not fetch your Substack (${visitorResponse.status}). Use format "yourname.substack.com" or "substack.com/@yourname". Make sure your Substack is public.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [creatorXML, visitorXML] = await Promise.all([
      creatorResponse.text(),
      visitorResponse.text(),
    ]);

    const creatorPosts = parseRSS(creatorXML);
    const visitorPosts = parseRSS(visitorXML);

    console.log("Parsed posts:", { creatorPosts: creatorPosts.length, visitorPosts: visitorPosts.length });

    if (creatorPosts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No posts found on creator's Substack. They may not have published anything yet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (visitorPosts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No posts found on your Substack. Make sure you have published posts." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI analysis
    const prompt = `You are analyzing two Substack newsletters to suggest collaboration topics.

CREATOR'S RECENT POSTS:
${creatorPosts.map((p, i) => `${i + 1}. "${p.title}"\n   ${p.description}`).join("\n\n")}

VISITOR'S RECENT POSTS:
${visitorPosts.map((p, i) => `${i + 1}. "${p.title}"\n   ${p.description}`).join("\n\n")}

Based on the themes, topics, and writing styles of both newsletters, suggest 3-5 compelling collaboration ideas that would appeal to both audiences. Focus on:
1. Overlapping interests or complementary perspectives
2. Unique angles where both writers could contribute their expertise
3. Topics that would provide value to readers of both newsletters

For each suggestion, provide:
- A catchy topic title
- A brief description of what the collaboration could cover
- The format (e.g., "Interview conversation", "Co-written essay", "Point/Counterpoint debate", "Joint deep-dive")
- Why this collaboration would work well based on their writing`;

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert at finding collaboration opportunities between content creators. Suggest creative, specific collaboration ideas based on their actual content." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_collaborations",
              description: "Return 3-5 collaboration topic suggestions based on both newsletters",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string", description: "A catchy title for the collaboration topic" },
                        description: { type: "string", description: "What the collaboration could cover (2-3 sentences)" },
                        format: { type: "string", description: "Suggested format like Interview, Co-write, Debate, etc." },
                        whyItWorks: { type: "string", description: "Why this would work well for both creators (1-2 sentences)" },
                      },
                      required: ["topic", "description", "format", "whyItWorks"],
                      additionalProperties: false,
                    },
                  },
                  creatorThemes: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 main themes from the creator's newsletter",
                  },
                  visitorThemes: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 main themes from the visitor's newsletter",
                  },
                },
                required: ["suggestions", "creatorThemes", "visitorThemes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_collaborations" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        suggestions: result.suggestions || [],
        creatorThemes: result.creatorThemes || [],
        visitorThemes: result.visitorThemes || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-collab-match error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
