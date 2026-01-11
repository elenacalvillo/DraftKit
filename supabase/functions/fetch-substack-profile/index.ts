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

function extractProfileData(html: string, isProfilePage: boolean): SubstackProfile {
  const result: SubstackProfile = {
    imageUrl: null,
    publicationName: null,
    tagline: null,
  };
  
  if (isProfilePage) {
    // PROFILE PAGE: Look for actual profile photo (not social card)
    console.log("Extracting from profile page - looking for actual profile photo");
    
    // Pattern 1: S3 bucket URLs (where real profile photos are stored)
    // These look like: https://substackcdn.com/image/fetch/.../bucketeer-...s3.amazonaws.com/.../image.png
    const s3ImageMatch = html.match(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]*bucketeer[^"]+)"/i);
    if (s3ImageMatch) {
      result.imageUrl = s3ImageMatch[1];
      console.log("Found profile image via S3 bucket URL");
    }
    
    // Pattern 2: Look for profile photo with square dimensions (profile photos are usually square like 1000x1000)
    if (!result.imageUrl) {
      const squareImageMatch = html.match(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]+_\d{3,4}x\d{3,4}\.(?:png|jpg|jpeg)[^"]*)"/i);
      if (squareImageMatch) {
        result.imageUrl = squareImageMatch[1];
        console.log("Found profile image via square dimension pattern");
      }
    }
    
    // Pattern 3: Look for user-head-photo or avatar class images
    if (!result.imageUrl) {
      const avatarMatch = html.match(/<img[^>]+class="[^"]*(?:user-head|avatar|profile-photo)[^"]*"[^>]+src="([^"]+)"/i) ||
                         html.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*(?:user-head|avatar|profile-photo)[^"]*"/i);
      if (avatarMatch) {
        result.imageUrl = avatarMatch[1];
        console.log("Found profile image via avatar class");
      }
    }
    
    // Pattern 4: Look for any image with public/images in the path (Substack profile storage)
    if (!result.imageUrl) {
      const publicImagesMatch = html.match(/src="(https:\/\/substackcdn\.com\/image\/fetch\/[^"]*public%2Fimages[^"]+)"/i);
      if (publicImagesMatch) {
        result.imageUrl = publicImagesMatch[1];
        console.log("Found profile image via public/images path");
      }
    }
    
    // Pattern 5: og:image as last resort (but skip if it looks like a subscribe card)
    if (!result.imageUrl) {
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                          html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
      if (ogImageMatch && !ogImageMatch[1].includes("subscribe-card") && !ogImageMatch[1].includes("aspectRatio%3Dlink")) {
        result.imageUrl = ogImageMatch[1];
        console.log("Found profile image via og:image fallback");
      }
    }
  } else {
    // PUBLICATION PAGE: Use meta tags for publication logo/cover
    console.log("Extracting from publication page - using meta tags");
    
    // Pattern 1: twitter:image meta tag
    const twitterImageMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i) ||
                             html.match(/<meta[^>]+content="([^"]+)"[^>]+name="twitter:image"/i);
    if (twitterImageMatch) {
      result.imageUrl = twitterImageMatch[1];
      console.log("Found image via twitter:image meta tag");
    }
    
    // Pattern 2: og:image meta tag
    if (!result.imageUrl) {
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                          html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
      if (ogImageMatch) {
        result.imageUrl = ogImageMatch[1];
        console.log("Found image via og:image meta tag");
      }
    }
    
    // Pattern 3: publication-cover-photo class
    if (!result.imageUrl) {
      const coverPhotoMatch = html.match(/<img[^>]+class="[^"]*publication-cover-photo[^"]*"[^>]+src="([^"]+)"/i) ||
                             html.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*publication-cover-photo[^"]*"/i);
      if (coverPhotoMatch) {
        result.imageUrl = coverPhotoMatch[1];
        console.log("Found image via publication-cover-photo class");
      }
    }
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
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CollabBot/1.0)",
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
