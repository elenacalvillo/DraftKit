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

async function fetchArchivePosts(username: string): Promise<ArchivePost[]> {
  const url = `https://${username}.substack.com/api/v1/archive?sort=new&limit=12`;
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
      console.error(`Archive fetch failed for ${username}: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Archive fetch error for ${username}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

function findCollabPost(posts: ArchivePost[], publishDate: string | null, collabLink: string | null): ArchivePost | null {
  if (!posts.length) return null;

  // Try matching by collab_link URL
  if (collabLink) {
    const match = posts.find(p => 
      collabLink.includes(p.slug) || p.canonical_url === collabLink
    );
    if (match) return match;
  }

  // Try matching by date (within 3 days of the requested_date or approved_at)
  if (publishDate) {
    const target = new Date(publishDate).getTime();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const match = posts.find(p => {
      const postTime = new Date(p.post_date).getTime();
      return Math.abs(postTime - target) < THREE_DAYS;
    });
    if (match) return match;
  }

  // Fallback: most recent post
  return posts[0];
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

    // If called with specific requestId, process just that one
    // If called without, process all published requests needing snapshots
    let requestsToProcess: { id: string; creator_id: string; collab_link: string | null; requested_date: string | null; requester_substack_url: string | null; approved_at: string | null; retro_completed_at: string | null }[] = [];

    if (requestId) {
      const { data, error } = await supabase
        .from("collab_requests")
        .select("id, creator_id, collab_link, requested_date, requester_substack_url, approved_at, retro_completed_at")
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
      // Cron mode: find all published requests that need a snapshot for the given day
      const day = snapshotDay ?? 0;
      
      // Get published requests that don't have this day's snapshot yet
      const { data: published, error } = await supabase
        .from("collab_requests")
        .select("id, creator_id, collab_link, requested_date, requester_substack_url, approved_at, retro_completed_at")
        .eq("status", "published")
        .not("retro_completed_at", "is", null);

      if (error || !published?.length) {
        return new Response(
          JSON.stringify({ message: "No published requests to process", count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter out ones that already have this snapshot
      const { data: existing } = await supabase
        .from("collab_metrics")
        .select("request_id")
        .eq("snapshot_day", day)
        .in("request_id", published.map(r => r.id));

      const existingIds = new Set((existing || []).map(e => e.request_id));
      
      // For day > 0, check if enough time has passed since publish
      const now = Date.now();
      requestsToProcess = published.filter(r => {
        if (existingIds.has(r.id)) return false;
        if (day === 0) return true;
        
        const publishedAt = new Date(r.retro_completed_at!).getTime();
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
        // Get creator's substack username
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

        // Fetch archive for both publications
        const [creatorPosts, requesterPosts] = await Promise.all([
          fetchArchivePosts(creatorUsername),
          requesterUsername ? fetchArchivePosts(requesterUsername) : Promise.resolve([]),
        ]);

        const publishDate = request.retro_completed_at || request.approved_at || request.requested_date;
        
        const creatorPost = findCollabPost(creatorPosts, publishDate, request.collab_link);
        const requesterPost = requesterPosts.length > 0 
          ? findCollabPost(requesterPosts, publishDate, null) 
          : null;

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
