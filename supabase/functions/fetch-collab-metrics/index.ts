import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SSRF Protection: Only allow Substack domains
function isAllowedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "https:") return false;
    const hostname = urlObj.hostname.toLowerCase();
    const blocked = [/^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./];
    if (blocked.some(p => p.test(hostname))) return false;
    return hostname.endsWith(".substack.com") || hostname === "substack.com";
  } catch {
    return false;
  }
}

interface ArchivePost {
  id: number;
  title: string;
  slug: string;
  post_date: string;
  canonical_url: string;
  reactions: Record<string, number> | number;
  reaction_count: number;
  comment_count: number;
}

function extractUsername(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  const withoutProtocol = cleaned.replace(/^https?:\/\//, "");

  // username.substack.com
  const subdomainMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]*)\.substack\.com/i);
  if (subdomainMatch) return subdomainMatch[1].toLowerCase();

  // substack.com/@username
  const profileMatch = withoutProtocol.match(/substack\.com\/@([a-zA-Z0-9_-]+)/i);
  if (profileMatch) return profileMatch[1].toLowerCase();

  // open.substack.com/pub/username
  const mobileMatch = withoutProtocol.match(/open\.substack\.com\/pub\/([a-zA-Z0-9_-]+)/i);
  if (mobileMatch) return mobileMatch[1].toLowerCase();

  // Bare username
  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,49}$/.test(withoutProtocol)) {
    return withoutProtocol.toLowerCase();
  }

  return null;
}

/**
 * Try to resolve a username to a working publication subdomain.
 * Profile URLs (substack.com/@user) may differ from publication subdomains.
 * Strategy: try archive API directly, if 404 try fetching profile page for redirect.
 */
async function resolvePublicationUsername(username: string): Promise<string | null> {
  // First, try the username directly
  const directUrl = `https://${username}.substack.com/api/v1/archive?sort=new&limit=1`;
  if (!isAllowedDomain(directUrl)) return null;

  try {
    const resp = await fetch(directUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)", "Accept": "application/json" },
      redirect: "follow",
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) return username;
    }
  } catch { /* continue */ }

  // If direct failed, try fetching the profile page to find the publication
  const profileUrl = `https://substack.com/@${username}`;
  if (!isAllowedDomain(profileUrl)) return null;

  try {
    const resp = await fetch(profileUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)" },
      redirect: "follow",
    });
    if (!resp.ok) return null;

    const html = await resp.text();
    // Look for publication subdomain in the HTML (e.g., href="https://realusername.substack.com")
    const pubMatch = html.match(/href="https:\/\/([a-zA-Z0-9_-]+)\.substack\.com\/?"/i);
    if (pubMatch) {
      const resolved = pubMatch[1].toLowerCase();
      if (resolved !== "substack" && resolved !== "open" && resolved !== "www") {
        console.log(`Resolved @${username} → ${resolved}.substack.com`);
        return resolved;
      }
    }
  } catch (err) {
    console.error(`Profile resolution failed for @${username}:`, err instanceof Error ? err.message : err);
  }

  return null;
}

async function fetchArchivePosts(username: string): Promise<ArchivePost[]> {
  // Try direct first, then resolve if needed
  const resolvedUsername = await resolvePublicationUsername(username);
  if (!resolvedUsername) {
    console.warn(`Could not resolve publication for username: ${username}`);
    return [];
  }

  const url = `https://${resolvedUsername}.substack.com/api/v1/archive?sort=new&limit=30`;
  if (!isAllowedDomain(url)) {
    console.warn(`SSRF blocked: ${url}`);
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)",
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`Archive fetch failed for ${resolvedUsername}: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Archive fetch error for ${resolvedUsername}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fetch metrics for a specific Substack post using the Substack API.
 * Extracts subdomain + slug from the URL and calls /api/v1/posts/{slug}.
 */
async function fetchPostByUrl(url: string): Promise<ArchivePost | null> {
  if (!isAllowedDomain(url)) {
    console.warn(`SSRF blocked: ${url}`);
    return null;
  }

  const slug = extractSlugFromUrl(url);
  if (!slug) {
    console.warn(`Could not extract slug from URL: ${url}`);
    return null;
  }

  // Extract subdomain (e.g. "promptledproduct" from "promptledproduct.substack.com/p/...")
  let subdomain: string | null = null;
  try {
    const urlObj = new URL(url);
    const subdomainMatch = urlObj.hostname.match(/^([a-zA-Z0-9_-]+)\.substack\.com$/i);
    if (subdomainMatch) subdomain = subdomainMatch[1].toLowerCase();
  } catch { /* continue */ }

  if (!subdomain) {
    console.warn(`Could not extract subdomain from URL: ${url}`);
    return null;
  }

  const apiUrl = `https://${subdomain}.substack.com/api/v1/posts/${slug}`;
  if (!isAllowedDomain(apiUrl)) {
    console.warn(`SSRF blocked: ${apiUrl}`);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)",
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`Substack API fetch failed for ${apiUrl}: ${resp.status}`);
      return null;
    }

    const data = await resp.json();

    // reactions is typically {"❤": 47, "🔥": 12} — sum all values
    const reactions = data.reactions ?? data.reaction_count ?? 0;
    const commentCount = data.comment_count ?? 0;
    const title = data.title ?? "";
    const postDate = data.post_date ?? new Date().toISOString();
    const canonicalUrl = data.canonical_url ?? url;

    console.log(`API fetch for ${apiUrl}: reactions=${JSON.stringify(reactions)}, comments=${commentCount}`);

    return {
      id: data.id ?? 0,
      title,
      slug,
      post_date: postDate,
      canonical_url: canonicalUrl,
      reactions,
      reaction_count: typeof reactions === "number" ? reactions : 0,
      comment_count: commentCount,
    };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Substack API fetch error for ${apiUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function extractSlugFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // e.g. /p/my-post-slug or /p/my-post-slug/comments
    const match = urlObj.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function findCollabPost(posts: ArchivePost[], publishDate: string | null, collabLink: string | null, strictMode: boolean = false): ArchivePost | null {
  if (!posts.length) return null;

  // Priority 1: Match by exact slug from the provided URL
  if (collabLink) {
    const slug = extractSlugFromUrl(collabLink);
    if (slug) {
      const match = posts.find(p => p.slug?.toLowerCase() === slug);
      if (match) return match;
    }
    // Fallback: partial match (only if not strict)
    if (!strictMode) {
      const match = posts.find(p => 
        collabLink.includes(p.slug) || p.canonical_url === collabLink
      );
      if (match) return match;
    }
    
    // In strict mode, if we have a manual URL but no match, return null
    // (Don't fall through to date matching)
    if (strictMode) return null;
  }

  // Priority 2: Match by date proximity (only if not strict mode)
  if (!strictMode && publishDate) {
    const target = new Date(publishDate).getTime();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const match = posts.find(p => {
      const postTime = new Date(p.post_date).getTime();
      return Math.abs(postTime - target) < THREE_DAYS;
    });
    if (match) return match;
  }

  // REMOVED: No longer fall back to "most recent post"
  return null;
}

function getReactionCount(post: ArchivePost): number {
  if (typeof post.reaction_count === "number") return post.reaction_count;
  if (typeof post.reactions === "number") return post.reactions;
  if (post.reactions && typeof post.reactions === "object") {
    return Object.values(post.reactions).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
  }
  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { requestId, snapshotDay } = body;

    let requestsToProcess: { id: string; creator_id: string; collab_link: string | null; requester_collab_link: string | null; requested_date: string | null; requester_substack_url: string | null; approved_at: string | null; retro_completed_at: string | null; created_at: string }[] = [];

    if (requestId) {
      const { data, error } = await supabase
        .from("collab_requests")
        .select("id, creator_id, collab_link, requester_collab_link, requested_date, requester_substack_url, approved_at, retro_completed_at, created_at")
        .eq("id", requestId)
        .eq("status", "published")
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Request not found or not published" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      requestsToProcess = [data];
    } else {
      const day = snapshotDay ?? 0;
      
      // Get ALL published requests (removed retro_completed_at filter)
      const { data: published, error } = await supabase
        .from("collab_requests")
        .select("id, creator_id, collab_link, requester_collab_link, requested_date, requester_substack_url, approved_at, retro_completed_at, created_at")
        .eq("status", "published");

      if (error || !published?.length) {
        return new Response(
          JSON.stringify({ message: "No published requests to process", count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await supabase
        .from("collab_metrics")
        .select("request_id")
        .eq("snapshot_day", day)
        .in("request_id", published.map(r => r.id));

      const existingIds = new Set((existing || []).map(e => e.request_id));
      
      const now = Date.now();
      requestsToProcess = published.filter(r => {
        if (existingIds.has(r.id)) return false;
        if (day === 0) return true;
        
        // Use retro_completed_at, approved_at, or created_at as publish reference
        const publishRef = r.retro_completed_at || r.approved_at || r.created_at;
        const publishedAt = new Date(publishRef).getTime();
        const daysSincePublish = (now - publishedAt) / (24 * 60 * 60 * 1000);
        return daysSincePublish >= day;
      });
    }

    if (!requestsToProcess.length) {
      return new Response(
        JSON.stringify({ message: "No requests need processing", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const request of requestsToProcess) {
      try {
        const { data: creator } = await supabase
          .from("creators")
          .select("substack_url, username")
          .eq("id", request.creator_id)
          .single();

        if (!creator?.substack_url) {
          console.log(`Skipping ${request.id}: no creator substack_url`);
          continue;
        }

        const creatorUsername = extractUsername(creator.substack_url);
        const requesterUsername = request.requester_substack_url 
          ? extractUsername(request.requester_substack_url) 
          : null;

        if (!creatorUsername) {
          console.log(`Skipping ${request.id}: could not extract creator username`);
          continue;
        }

        const [creatorPosts, requesterPosts] = await Promise.all([
          fetchArchivePosts(creatorUsername),
          requesterUsername ? fetchArchivePosts(requesterUsername) : Promise.resolve([]),
        ]);

        // Use best available date reference
        const publishDate = request.retro_completed_at || request.approved_at || request.requested_date || request.created_at;
        
        // Use strict mode when manual URLs are provided (prioritize user input over heuristics)
        let creatorPost = findCollabPost(
          creatorPosts, 
          publishDate, 
          request.collab_link,
          !!request.collab_link // strict mode if manual URL provided
        );
        
        // NEW: If manual URL provided but not found in archive, try direct fetch
        if (!creatorPost && request.collab_link) {
          console.log(`Creator post not in archive, attempting direct fetch: ${request.collab_link}`);
          creatorPost = await fetchPostByUrl(request.collab_link);
        }
        
        let requesterPost = requesterPosts.length > 0 
          ? findCollabPost(
              requesterPosts, 
              publishDate, 
              request.requester_collab_link,
              !!request.requester_collab_link // strict mode if manual URL provided
            )
          : null;
        
        // NEW: If manual URL provided but not found in archive, try direct fetch
        if (!requesterPost && request.requester_collab_link) {
          console.log(`Requester post not in archive, attempting direct fetch: ${request.requester_collab_link}`);
          requesterPost = await fetchPostByUrl(request.requester_collab_link);
        }

        const day = snapshotDay ?? 0;

        const metric = {
          request_id: request.id,
          snapshot_day: day,
          creator_post_url: creatorPost?.canonical_url || null,
          creator_likes: creatorPost ? getReactionCount(creatorPost) : null,
          creator_comments: creatorPost?.comment_count ?? null,
          requester_post_url: requesterPost?.canonical_url || null,
          requester_likes: requesterPost ? getReactionCount(requesterPost) : null,
          requester_comments: requesterPost?.comment_count ?? null,
        };

        const { error: upsertError } = await supabase
          .from("collab_metrics")
          .upsert(metric, { onConflict: "request_id,snapshot_day" });

        if (upsertError) {
          console.error(`Failed to upsert metrics for ${request.id}:`, upsertError);
        } else {
          results.push({ requestId: request.id, day, creatorPost: creatorPost?.title, requesterPost: requesterPost?.title });
        }
      } catch (err) {
        console.error(`Error processing ${request.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ message: "Metrics collected", count: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-collab-metrics error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
