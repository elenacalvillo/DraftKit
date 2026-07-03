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
    return hostname.endsWith(".substack.com") || hostname === "substack.com" || hostname === "substack.app";
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
 */
async function resolvePublicationUsername(username: string): Promise<string | null> {
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

  const profileUrl = `https://substack.com/@${username}`;
  if (!isAllowedDomain(profileUrl)) return null;

  try {
    const resp = await fetch(profileUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)" },
      redirect: "follow",
    });
    if (!resp.ok) return null;

    const html = await resp.text();
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

/**
 * Follow redirects to resolve any Substack URL to its canonical form.
 * Substack always redirects to username.substack.com/p/slug eventually.
 */
async function resolveCanonicalUrl(url: string): Promise<string | null> {
  if (!isAllowedDomain(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const finalUrl = resp.url;
    if (!finalUrl) return null;

    // Validate the resolved URL is on an allowed domain and has /p/ path
    if (!isAllowedDomain(finalUrl)) return null;

    const finalObj = new URL(finalUrl);
    if (finalObj.pathname.match(/\/p\/[a-zA-Z0-9_-]+/)) {
      console.log(`Resolved canonical: ${url} → ${finalUrl}`);
      return finalUrl;
    }

    // Even without /p/, return if it landed on a substack subdomain
    if (finalObj.hostname.match(/^[a-zA-Z0-9_-]+\.substack\.com$/i)) {
      console.log(`Resolved to subdomain (no /p/): ${url} → ${finalUrl}`);
      return finalUrl;
    }

    return null;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Canonical resolution failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchArchivePosts(username: string): Promise<ArchivePost[]> {
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
 * Extract slug or numeric post ID from a Substack URL.
 * Supports:
 *   - /p/my-post-slug (classic)
 *   - /p-192157347 (profile-style numeric ID)
 *   - /pub/username/p/slug (open.substack.com mobile)
 */
function extractSlugFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Classic: /p/my-post-slug or /pub/username/p/slug
    const classicMatch = urlObj.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (classicMatch) return classicMatch[1].toLowerCase();

    // Profile-style: /p-192157347
    const numericMatch = urlObj.pathname.match(/\/p-(\d+)/);
    if (numericMatch) return numericMatch[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Scrape the slug from a profile-style Substack post page by parsing the HTML.
 * Looks for the post slug in embedded JSON data on the page.
 */
async function scrapeSlugFromProfilePage(url: string): Promise<string | null> {
  if (!isAllowedDomain(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)", "Accept": "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const html = await resp.text();

    // Look for the slug in embedded JSON: "slug":"my-post-slug"
    // Match near the post ID to avoid picking up unrelated slugs
    const slugMatch = html.match(/"slug"\s*:\s*"([a-zA-Z0-9_-]+)"/);
    if (slugMatch) {
      console.log(`Scraped slug from profile page: ${slugMatch[1]}`);
      return slugMatch[1].toLowerCase();
    }

    // Fallback: look for canonical subdomain URL with /p/ in the page
    const canonMatch = html.match(/https:\/\/([a-zA-Z0-9_-]+)\.substack\.com\/p\/([a-zA-Z0-9_-]+)/);
    if (canonMatch) {
      console.log(`Found canonical link in page: ${canonMatch[0]}`);
      return canonMatch[2].toLowerCase();
    }

    return null;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Slug scrape failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}


/**
 * Fetch metrics for a specific Substack post.
 * Tries multiple strategies:
 *   1. Direct subdomain + slug extraction (classic URLs)
 *   2. Follow redirects to find canonical URL (profile/mobile/app URLs)
 *   3. Username resolution + numeric post ID via archive
 */
async function fetchPostByUrl(url: string): Promise<ArchivePost | null> {
  if (!isAllowedDomain(url)) {
    console.warn(`SSRF blocked: ${url}`);
    return null;
  }

  const slug = extractSlugFromUrl(url);

  // --- Strategy 1: Direct subdomain + slug (classic URLs) ---
  let subdomain: string | null = null;
  try {
    const urlObj = new URL(url);
    const subdomainMatch = urlObj.hostname.match(/^([a-zA-Z0-9_-]+)\.substack\.com$/i);
    if (subdomainMatch && subdomainMatch[1].toLowerCase() !== "open" && subdomainMatch[1].toLowerCase() !== "www") {
      subdomain = subdomainMatch[1].toLowerCase();
    }
  } catch { /* continue */ }

  if (subdomain && slug) {
    const result = await fetchPostFromApi(subdomain, slug);
    if (result) return result;
  }

  // --- Strategy 2: Follow redirects to canonical URL ---
  console.log(`Strategy 1 failed for ${url}, trying redirect resolution...`);
  const canonical = await resolveCanonicalUrl(url);
  if (canonical && canonical !== url) {
    const canonSlug = extractSlugFromUrl(canonical);
    let canonSubdomain: string | null = null;
    try {
      const canonObj = new URL(canonical);
      const m = canonObj.hostname.match(/^([a-zA-Z0-9_-]+)\.substack\.com$/i);
      if (m && m[1].toLowerCase() !== "open" && m[1].toLowerCase() !== "www") {
        canonSubdomain = m[1].toLowerCase();
      }
    } catch { /* continue */ }

    if (canonSubdomain && canonSlug) {
      const result = await fetchPostFromApi(canonSubdomain, canonSlug);
      if (result) return result;
    }
  }

  // --- Strategy 3: Username resolution + numeric post ID via archive ---
  // Substack's /api/v1/posts/{id} doesn't accept numeric IDs, only slugs.
  // So we fetch the archive and match by numeric post ID to get the slug.
  const username = extractUsername(url);
  if (username && slug && /^\d+$/.test(slug)) {
    console.log(`Trying username resolution for @${username} with post ID ${slug}...`);
    const resolvedSubdomain = await resolvePublicationUsername(username);
    if (resolvedSubdomain) {
      // Fetch archive and find the post by numeric ID
      const archivePosts = await fetchArchivePosts(resolvedSubdomain);
      const numericId = parseInt(slug, 10);
      const matchedPost = archivePosts.find(p => p.id === numericId);
      if (matchedPost) {
        console.log(`Found post by ID ${numericId} → slug: ${matchedPost.slug}`);
        return matchedPost;
      }
      // If not in recent 30 posts, try fetching by slug from the HTML page
      console.log(`Post ID ${numericId} not in recent archive, trying HTML scrape...`);
      const pageSlug = await scrapeSlugFromProfilePage(url);
      if (pageSlug) {
        const result = await fetchPostFromApi(resolvedSubdomain, pageSlug);
        if (result) return result;
      }
    }
  }

  console.warn(`All strategies failed for URL: ${url}`);
  return null;
}

/**
 * Fetch a single post from the Substack API given subdomain + slug/id.
 */
async function fetchPostFromApi(subdomain: string, slugOrId: string): Promise<ArchivePost | null> {
  const apiUrl = `https://${subdomain}.substack.com/api/v1/posts/${slugOrId}`;
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

    const reactions = data.reactions ?? data.reaction_count ?? 0;
    const commentCount = data.comment_count ?? 0;
    const title = data.title ?? "";
    const postDate = data.post_date ?? new Date().toISOString();
    const canonicalUrl = data.canonical_url ?? `https://${subdomain}.substack.com/p/${data.slug || slugOrId}`;

    console.log(`API fetch for ${apiUrl}: reactions=${JSON.stringify(reactions)}, comments=${commentCount}`);

    return {
      id: data.id ?? 0,
      title,
      slug: data.slug || slugOrId,
      post_date: postDate,
      canonical_url: canonicalUrl,
      reactions,
      reaction_count: typeof reactions === "number"
        ? reactions
        : (typeof reactions === "object" && reactions !== null
            ? Object.values(reactions).reduce((a: number, b) => a + (typeof b === "number" ? b : 0), 0)
            : 0),
      comment_count: commentCount,
    };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Substack API fetch error for ${apiUrl}:`, err instanceof Error ? err.message : err);
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

/**
 * Fetch subscriber count for a Substack publication.
 */
async function fetchSubscriberCount(subdomain: string): Promise<number | null> {
  const url = `https://${subdomain}.substack.com`;
  if (!isAllowedDomain(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)",
        "Accept": "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.warn(`Subscriber fetch failed for ${subdomain}: ${resp.status}`);
      return null;
    }

    const html = await resp.text();

    const patterns = [
      /"subscriber_count"\s*:\s*(\d+)/,
      /"freeSubscriberCount"\s*:\s*(\d+)/,
      /"subscriberCount"\s*:\s*(\d+)/,
      /"active_subscription_count"\s*:\s*(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          console.log(`Subscriber count for ${subdomain}: ${count}`);
          return count;
        }
      }
    }

    console.log(`No subscriber count found in HTML for ${subdomain}`);
    return null;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`Subscriber fetch error for ${subdomain}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require shared secret to prevent unauthenticated abuse (cron-only endpoint)
  const providedSecret = req.headers.get("x-internal-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.warn("unauthorized invocation blocked");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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

        const publishDate = request.retro_completed_at || request.approved_at || request.requested_date || request.created_at;
        
        let creatorPost = findCollabPost(
          creatorPosts, 
          publishDate, 
          request.collab_link,
          !!request.collab_link
        );
        
        if (!creatorPost && request.collab_link) {
          console.log(`Creator post not in archive, attempting direct fetch: ${request.collab_link}`);
          creatorPost = await fetchPostByUrl(request.collab_link);
        }
        
        let requesterPost = requesterPosts.length > 0 
          ? findCollabPost(
              requesterPosts, 
              publishDate, 
              request.requester_collab_link,
              !!request.requester_collab_link
            )
          : null;
        
        if (!requesterPost && request.requester_collab_link) {
          console.log(`Requester post not in archive, attempting direct fetch: ${request.requester_collab_link}`);
          requesterPost = await fetchPostByUrl(request.requester_collab_link);
        }

        const day = snapshotDay ?? 0;

        const [creatorSubs, requesterSubs] = await Promise.all([
          creatorUsername ? fetchSubscriberCount(creatorUsername) : Promise.resolve(null),
          requesterUsername ? fetchSubscriberCount(requesterUsername) : Promise.resolve(null),
        ]);

        const metric = {
          request_id: request.id,
          snapshot_day: day,
          creator_post_url: creatorPost?.canonical_url || null,
          creator_likes: creatorPost ? getReactionCount(creatorPost) : null,
          creator_comments: creatorPost?.comment_count ?? null,
          requester_post_url: requesterPost?.canonical_url || null,
          requester_likes: requesterPost ? getReactionCount(requesterPost) : null,
          requester_comments: requesterPost?.comment_count ?? null,
          creator_subscribers: creatorSubs,
          requester_subscribers: requesterSubs,
        };

        const { error: insertError } = await supabase
          .from("collab_metrics")
          .insert(metric);

        if (insertError) {
          console.error(`Failed to insert metric for ${request.id}:`, insertError);
          continue;
        }

        results.push({ request_id: request.id, ...metric });
        console.log(`Metrics saved for ${request.id}: creator=${creatorPost ? "found" : "not found"}, requester=${requesterPost ? "found" : "not found"}`);
      } catch (err) {
        console.error(`Error processing request ${request.id}:`, err instanceof Error ? err.message : err);
      }
    }

    return new Response(
      JSON.stringify({ message: "Metrics collected", count: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Fatal error:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
