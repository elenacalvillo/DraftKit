import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= RATE LIMITING =============
// Simple in-memory rate limiter with sliding window
// Limits: 20 requests/hour for unauthenticated, 100/hour for authenticated
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const UNAUTH_RATE_LIMIT = 20;
const AUTH_RATE_LIMIT = 100;

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

interface SubstackProfile {
  imageUrl: string | null;
  publicationName: string | null;
  tagline: string | null;
}

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

function normalizeSubstackUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, "");
  
  // Handle profile format: substack.com/@username - keep as-is (personal profile page)
  const profileMatch = normalized.match(/substack\.com\/@([a-zA-Z0-9_-]+)/i);
  if (profileMatch) {
    // Personal profile URLs should stay as substack.com/@username
    if (!normalized.startsWith("http")) {
      normalized = `https://${normalized}`;
    }
    return normalized;
  }
  
  // Handle just username (assume publication subdomain)
  if (!normalized.includes(".") && !normalized.includes("/")) {
    normalized = `https://${normalized}.substack.com`;
  }
  
  // Ensure https
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  
  return normalized;
}

function isValidProfileImage(url: string): boolean {
  // Reject social cards, subscribe cards, and other non-profile images
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  const invalidPatterns = [
    'subscribe-card',
    'twitter/subscribe-card',
    'aspectratio%3dlink',
    'aspectratio=link',
    'twitter_name',
    'og_image',
    'social',
    'cover_image',
    'newsletter_logo',
  ];
  return !invalidPatterns.some(pattern => lowerUrl.includes(pattern));
}

function sanitizeSubstackImageUrl(url: string): string {
  if (!url) return url;
  return url.replace(/\$s_![^!]*!,?/, '');
}

function extractProfileData(html: string, isProfilePage: boolean): SubstackProfile {
  const result: SubstackProfile = {
    imageUrl: null,
    publicationName: null,
    tagline: null,
  };
  
  // Collect all candidate images first, then pick the best one
  const candidateImages: { url: string; priority: number; source: string }[] = [];
  
  if (isProfilePage) {
    // PROFILE PAGE: Look for actual profile photo (not social card)
    console.log("Extracting from profile page - looking for actual profile photo");
    
    // Pattern 1: S3 bucket URLs with public/images path (highest priority - actual profile photos)
    const s3PublicImagesMatches = html.matchAll(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]*bucketeer[^"]*public%2Fimages[^"]+)"/gi);
    for (const match of s3PublicImagesMatches) {
      if (isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 1, source: 'S3 public/images' });
      }
    }
    
    // Pattern 2: Any S3 bucket URL (second priority)
    const s3ImageMatches = html.matchAll(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]*bucketeer[^"]+)"/gi);
    for (const match of s3ImageMatches) {
      if (isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 2, source: 'S3 bucket' });
      }
    }
    
    // Pattern 3: Profile photo with square dimensions (profile photos are usually 1000x1000)
    const squareImageMatches = html.matchAll(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]+_(\d{3,4})x(\d{3,4})\.(?:png|jpg|jpeg)[^"]*)"/gi);
    for (const match of squareImageMatches) {
      const width = parseInt(match[2]);
      const height = parseInt(match[3]);
      // Only consider if roughly square
      if (Math.abs(width - height) < 100 && isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 3, source: 'square dimensions' });
      }
    }
    
    // Pattern 4: Look for user-head-photo, avatar, or profile-photo class images
    const avatarPatterns = [
      /<img[^>]+class="[^"]*(?:user-head|avatar|profile-photo|pencraft-img)[^"]*"[^>]+src="([^"]+)"/gi,
      /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(?:user-head|avatar|profile-photo|pencraft-img)[^"]*"/gi,
    ];
    for (const pattern of avatarPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (isValidProfileImage(match[1])) {
          candidateImages.push({ url: match[1], priority: 4, source: 'avatar class' });
        }
      }
    }
    
    // Pattern 5: Look for any substackcdn image in public/images path
    const publicImagesMatches = html.matchAll(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]*public%2Fimages[^"]+)"/gi);
    for (const match of publicImagesMatches) {
      if (isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 5, source: 'public/images path' });
      }
    }
    
    // Pattern 6: substack-post-media images as backup
    const postMediaMatches = html.matchAll(/src="(https:\/\/substack-post-media\.s3\.amazonaws\.com\/public\/images\/[^"]+)"/gi);
    for (const match of postMediaMatches) {
      if (isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 6, source: 'substack-post-media' });
      }
    }
    
  } else {
    // PUBLICATION PAGE: Look for author image first, then fall back to publication logo
    console.log("Extracting from publication page - looking for author/publication image");
    
    // Pattern 1: Look for author image in the about section or byline
    const authorPatterns = [
      /<img[^>]+class="[^"]*(?:author|user-head|avatar|profile)[^"]*"[^>]+src="([^"]+)"/gi,
      /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(?:author|user-head|avatar|profile)[^"]*"/gi,
      /<a[^>]+class="[^"]*author[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi,
    ];
    for (const pattern of authorPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (isValidProfileImage(match[1])) {
          candidateImages.push({ url: match[1], priority: 1, source: 'author class' });
        }
      }
    }
    
    // Pattern 2: S3 bucket profile images
    const s3ImageMatches = html.matchAll(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]*bucketeer[^"]*public%2Fimages[^"]+)"/gi);
    for (const match of s3ImageMatches) {
      if (isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 2, source: 'S3 public/images' });
      }
    }
    
    // Pattern 3: substack-post-media images
    const postMediaMatches = html.matchAll(/src="(https:\/\/substack-post-media\.s3\.amazonaws\.com\/public\/images\/[^"]+)"/gi);
    for (const match of postMediaMatches) {
      if (isValidProfileImage(match[1])) {
        candidateImages.push({ url: match[1], priority: 3, source: 'substack-post-media' });
      }
    }
    
    // Pattern 4: og:image/twitter:image as fallback (but filter carefully)
    const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                        html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogImageMatch && isValidProfileImage(ogImageMatch[1])) {
      candidateImages.push({ url: ogImageMatch[1], priority: 10, source: 'og:image fallback' });
    }
  }
  
  // Sort by priority and pick the best one
  candidateImages.sort((a, b) => a.priority - b.priority);
  
  if (candidateImages.length > 0) {
    result.imageUrl = candidateImages[0].url;
    console.log(`Found profile image via ${candidateImages[0].source} (${candidateImages.length} candidates)`);
  } else {
    console.log("No valid profile image found");
  }
  
  // Extract publication name from og:site_name or title
  const siteNameMatch = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i) ||
                       html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:site_name"/i);
  if (siteNameMatch) {
    result.publicationName = siteNameMatch[1];
  } else {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.publicationName = titleMatch[1].split("|")[0].trim();
    }
  }
  
  // Extract tagline/description
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                   html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
  if (descMatch) {
    result.tagline = descMatch[1];
  } else {
    const ogDescMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
                       html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
    if (ogDescMatch) {
      result.tagline = ogDescMatch[1];
    }
  }
  
  return result;
}

serve(async (req) => {
  console.log("=== fetch-substack-profile invoked ===");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req);
    
    // --- OPTIONAL AUTHENTICATION ---
    // This function is used during public booking for profile image fetching.
    // Auth is optional - we apply stricter rate limits for unauthenticated requests.
    const authHeader = req.headers.get("Authorization");
    const isAuthenticated = authHeader?.startsWith("Bearer ");
    
    if (isAuthenticated) {
      console.log("Request has auth token (authenticated user)");
    } else {
      console.log("Request from unauthenticated visitor");
    }
    
    // --- RATE LIMITING ---
    const rateLimitKey = getRateLimitKey(clientIP, isAuthenticated ? "auth" : null);
    const rateLimit = isAuthenticated ? AUTH_RATE_LIMIT : UNAUTH_RATE_LIMIT;
    const rateLimitResult = checkRateLimit(rateLimitKey, rateLimit);
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          imageUrl: null,
          publicationName: null,
          tagline: null,
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
    
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));
    
    const { substackUrl } = body;
    
    if (!substackUrl) {
      console.error("Missing substackUrl in request");
      return new Response(
        JSON.stringify({ error: "substackUrl is required", imageUrl: null, publicationName: null, tagline: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const normalizedUrl = normalizeSubstackUrl(substackUrl);
    console.log(`Normalized URL: ${normalizedUrl}`);
    
    // SSRF Protection: Validate URL before fetching
    if (!isAllowedDomain(normalizedUrl)) {
      console.error(`SSRF blocked for URL: ${normalizedUrl}`);
      return new Response(
        JSON.stringify({ 
          error: "Only Substack URLs are supported (*.substack.com)",
          imageUrl: null,
          publicationName: null,
          tagline: null,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DraftKit/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log(`Fetch response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch Substack page: ${response.status}`);
        return new Response(
          JSON.stringify({ 
            error: "Failed to fetch profile",
            imageUrl: null,
            publicationName: null,
            tagline: null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const html = await response.text();
      console.log(`Fetched HTML length: ${html.length} characters`);
      
      // Detect if this is a profile page vs publication page
      const isProfilePage = normalizedUrl.includes("substack.com/@");
      console.log(`Page type: ${isProfilePage ? "profile" : "publication"}`);
      
      const profileData = extractProfileData(html, isProfilePage);
      // Sanitize the image URL before returning
      if (profileData.imageUrl) {
        profileData.imageUrl = sanitizeSubstackImageUrl(profileData.imageUrl);
      }
      console.log(`Extracted profile data:`, JSON.stringify(profileData));
      
      return new Response(
        JSON.stringify(profileData),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error("Fetch error:", fetchError instanceof Error ? fetchError.message : "Unknown error");
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch profile",
          imageUrl: null,
          publicationName: null,
          tagline: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
  } catch (error) {
    console.error("Error in fetch-substack-profile:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred",
        imageUrl: null,
        publicationName: null,
        tagline: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
