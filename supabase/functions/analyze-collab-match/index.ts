import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= RATE LIMITING =============
// Simple in-memory rate limiter with sliding window
// Limits: 10 requests/hour for unauthenticated, 50/hour for authenticated
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const UNAUTH_RATE_LIMIT = 10;
const AUTH_RATE_LIMIT = 50;

interface RateLimitEntry {
  requests: number[];
  lastCleanup: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitKey(ip: string, userId: string | null): string {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

function cleanupOldRequests(entry: RateLimitEntry): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
  entry.lastCleanup = now;
}

function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  
  if (!entry) {
    entry = { requests: [], lastCleanup: now };
    rateLimitStore.set(key, entry);
  }
  
  // Cleanup old requests periodically
  if (now - entry.lastCleanup > 60000) { // Cleanup every minute
    cleanupOldRequests(entry);
  }
  
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentRequests = entry.requests.filter(t => t > windowStart);
  
  if (recentRequests.length >= limit) {
    const oldestRequest = Math.min(...recentRequests);
    const resetIn = Math.ceil((oldestRequest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  // Record this request
  entry.requests = [...recentRequests, now];
  
  return { 
    allowed: true, 
    remaining: limit - entry.requests.length,
    resetIn: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
  };
}

function getClientIP(req: Request): string {
  // Try various headers that might contain the real client IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP;
  }
  
  return "unknown";
}
// ============= END RATE LIMITING =============

interface RSSPost {
  title: string;
  description: string;
  author: string | null;
  pubDate: string | null;
  link: string | null;
}

interface ArticleSource {
  title: string;
  author: string | null;
  relevance: string;
}

interface SourcesUsed {
  creatorArticles: ArticleSource[];
  visitorArticles: ArticleSource[];
}

interface CollabSuggestion {
  topic: string;
  description: string;
  format: string;
  whyItWorks: string;
}

// Extract feed-level author from RSS XML
function extractFeedAuthor(xml: string): string | null {
  // Try various author tag patterns at feed level
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
    // This prevents SSRF to arbitrary internal services
    if (hostname.endsWith(".substack.com") || hostname === "substack.com") {
      return true;
    }
    
    // Allow custom domains that are explicitly used for newsletters
    // These are validated by being in our database as creator newsletter URLs
    // For now, reject any non-substack domains to prevent SSRF
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

// Parse RSS XML and extract post titles, descriptions, and authors
function parseRSS(xml: string): { posts: RSSPost[]; feedAuthor: string | null } {
  const posts: RSSPost[] = [];
  const feedAuthor = extractFeedAuthor(xml);
  
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
    
    if (title) {
      posts.push({ title, description, author, pubDate, link });
    }
  }
  
  return { posts, feedAuthor };
}

// Normalize a name for comparison (lowercase, remove special chars)
function normalizeName(name: string | null): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Filter posts to only include those by the expected author
function filterByAuthor(posts: RSSPost[], expectedAuthor: string | null): RSSPost[] {
  // If no expected author or no posts have author info, return all
  if (!expectedAuthor || !posts.some(p => p.author)) {
    return posts;
  }
  
  const normalizedExpected = normalizeName(expectedAuthor);
  
  const filtered = posts.filter(p => {
    if (!p.author) return true; // Include if no author specified on item
    const normalizedAuthor = normalizeName(p.author);
    // Fuzzy match: check if either contains the other
    return normalizedAuthor.includes(normalizedExpected) || 
           normalizedExpected.includes(normalizedAuthor);
  });
  
  // If filtering removes too many posts (less than 2), return originals
  // This handles edge cases where author detection isn't reliable
  if (filtered.length < 2 && posts.length >= 2) {
    console.log(`Author filtering too aggressive, keeping all ${posts.length} posts`);
    return posts;
  }
  
  console.log(`Filtered from ${posts.length} to ${filtered.length} posts by author: ${expectedAuthor}`);
  return filtered;
}

// Convert Substack URL to RSS feed URL
// Handles all Substack URL formats including mobile share links
function toRSSUrl(substackUrl: string): string {
  let url = substackUrl.trim();
  
  // Remove query parameters and hash fragments first (handles mobile share UTM params)
  url = url.replace(/[?#].*$/, "");
  
  // Remove trailing slashes
  url = url.replace(/\/+$/, "");
  
  // Remove protocol for pattern matching
  const withoutProtocol = url.replace(/^https?:\/\//, "");
  
  // Pattern 1: open.substack.com/pub/username (Mobile share format)
  const mobileMatch = withoutProtocol.match(/^open\.substack\.com\/pub\/([a-zA-Z0-9_-]+)/i);
  if (mobileMatch) {
    url = `https://${mobileMatch[1].toLowerCase()}.substack.com`;
    console.log(`Converted mobile share URL to newsletter format: ${url}`);
  }
  // Pattern 2: substack.com/@username (Profile format)
  else {
    const profileMatch = withoutProtocol.match(/^(?:www\.)?substack\.com\/@([a-zA-Z0-9_-]+)/i);
    if (profileMatch) {
      url = `https://${profileMatch[1].toLowerCase()}.substack.com`;
      console.log(`Converted profile URL to newsletter format: ${url}`);
    }
    // Pattern 3: Just username (no dots or slashes)
    else if (!withoutProtocol.includes('.') && !withoutProtocol.includes('/')) {
      url = `https://${withoutProtocol.toLowerCase()}.substack.com`;
      console.log(`Converted username to newsletter format: ${url}`);
    }
    // Standard format or custom domain - ensure https://
    else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
  }
  
  // Add /feed if not present
  if (!url.endsWith("/feed")) {
    url = url + "/feed";
  }
  
  console.log(`Final RSS URL: ${url}`);
  return url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req);
    
    // --- OPTIONAL AUTHENTICATION ---
    // This function is used during public booking, so auth is optional.
    // When auth is present, we validate it. When absent, we apply stricter rate limits.
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!userError && user) {
        userId = user.id;
        console.log(`Authenticated user: ${userId}`);
      }
    }
    
    console.log(`Request from ${userId ? `user ${userId}` : 'unauthenticated visitor'} (IP: ${clientIP})`);
    
    // --- RATE LIMITING ---
    const rateLimitKey = getRateLimitKey(clientIP, userId);
    const rateLimit = userId ? AUTH_RATE_LIMIT : UNAUTH_RATE_LIMIT;
    const rateLimitResult = checkRateLimit(rateLimitKey, rateLimit);
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimitResult.resetIn
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.resetIn.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetIn.toString()
          } 
        }
      );
    }
    
    console.log(`Rate limit check passed. Remaining: ${rateLimitResult.remaining}/${rateLimit}`);
    // --- END RATE LIMITING ---

    const { creatorSubstackUrl, visitorSubstackUrl } = await req.json();

    if (!creatorSubstackUrl || !visitorSubstackUrl) {
      return new Response(
        JSON.stringify({ error: "Both Substack URLs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch both RSS feeds in parallel with security limits
    const [creatorRSSUrl, visitorRSSUrl] = [
      toRSSUrl(creatorSubstackUrl),
      toRSSUrl(visitorSubstackUrl),
    ];

    console.log("Fetching RSS feeds:", { creatorRSSUrl, visitorRSSUrl });

    const [creatorResult, visitorResult] = await Promise.all([
      fetchRSSWithLimits(creatorRSSUrl),
      fetchRSSWithLimits(visitorRSSUrl),
    ]);

    if (!creatorResult.ok) {
      console.error(`Creator RSS fetch failed: ${creatorResult.error} for URL: ${creatorRSSUrl}`);
      return new Response(
        JSON.stringify({ 
          error: `Could not fetch creator's newsletter. Please check the URL format.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!visitorResult.ok) {
      console.error(`Visitor RSS fetch failed: ${visitorResult.error} for URL: ${visitorRSSUrl}`);
      return new Response(
        JSON.stringify({ 
          error: `Could not fetch your newsletter. Please check the URL and ensure it's public.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creatorXML = creatorResult.text;
    const visitorXML = visitorResult.text;

    // Parse RSS with author extraction
    const creatorParsed = parseRSS(creatorXML);
    const visitorParsed = parseRSS(visitorXML);
    
    // Filter posts to only those by the feed owner
    const creatorPosts = filterByAuthor(creatorParsed.posts, creatorParsed.feedAuthor);
    const visitorPosts = filterByAuthor(visitorParsed.posts, visitorParsed.feedAuthor);

    console.log("Parsed posts:", { 
      creatorPosts: creatorPosts.length, 
      creatorFeedAuthor: creatorParsed.feedAuthor,
      visitorPosts: visitorPosts.length,
      visitorFeedAuthor: visitorParsed.feedAuthor
    });

    if (creatorPosts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No posts found on creator's newsletter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (visitorPosts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No posts found on your newsletter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI analysis with author attribution
    const prompt = `You are analyzing two Substack newsletters to suggest collaboration topics.

IMPORTANT: Only analyze articles ACTUALLY WRITTEN BY the newsletter owner. 
If you see guest posts or collaborations from other authors, IGNORE THEM.
Pay attention to the author field for each article.

CREATOR'S RECENT POSTS (Owner: ${creatorParsed.feedAuthor || "Unknown"}):
${creatorPosts.map((p, i) => `${i + 1}. "${p.title}"${p.author ? ` [by ${p.author}]` : ""}\n   ${p.description}`).join("\n\n")}

VISITOR'S RECENT POSTS (Owner: ${visitorParsed.feedAuthor || "Unknown"}):
${visitorPosts.map((p, i) => `${i + 1}. "${p.title}"${p.author ? ` [by ${p.author}]` : ""}\n   ${p.description}`).join("\n\n")}

Based on the themes, topics, and writing styles of both newsletters, suggest 3-5 compelling collaboration ideas that would appeal to both audiences. Focus on:
1. Overlapping interests or complementary perspectives
2. Unique angles where both writers could contribute their expertise
3. Topics that would provide value to readers of both newsletters

For each suggestion, provide:
- A catchy topic title
- A brief description of what the collaboration could cover
- The format (e.g., "Interview conversation", "Co-written essay", "Point/Counterpoint debate", "Joint deep-dive")
- Why this collaboration would work well based on their writing

Also list which specific articles you based each suggestion on for transparency.`;

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
          { role: "system", content: "You are an expert at finding collaboration opportunities between content creators. Suggest creative, specific collaboration ideas based on their actual content. Always cite which articles informed your suggestions." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_collaborations",
              description: "Return 3-5 collaboration topic suggestions based on both newsletters with source attribution",
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
                  sourcesUsed: {
                    type: "object",
                    properties: {
                      creatorArticles: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string", description: "Article title" },
                            author: { type: "string", description: "Article author (if known)" },
                            relevance: { type: "string", description: "Why this article was used for suggestions" },
                          },
                          required: ["title", "relevance"],
                          additionalProperties: false,
                        },
                        description: "Articles from the creator's newsletter used to form suggestions",
                      },
                      visitorArticles: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string", description: "Article title" },
                            author: { type: "string", description: "Article author (if known)" },
                            relevance: { type: "string", description: "Why this article was used for suggestions" },
                          },
                          required: ["title", "relevance"],
                          additionalProperties: false,
                        },
                        description: "Articles from the visitor's newsletter used to form suggestions",
                      },
                    },
                    required: ["creatorArticles", "visitorArticles"],
                    additionalProperties: false,
                    description: "Source articles used to generate the suggestions for transparency",
                  },
                },
                required: ["suggestions", "creatorThemes", "visitorThemes", "sourcesUsed"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_collaborations" } },
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
        JSON.stringify({ error: "Analysis failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response received successfully");

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Analysis failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        suggestions: result.suggestions || [],
        creatorThemes: result.creatorThemes || [],
        visitorThemes: result.visitorThemes || [],
        sourcesUsed: result.sourcesUsed || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-collab-match error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
