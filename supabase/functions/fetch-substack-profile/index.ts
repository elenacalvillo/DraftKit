import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        console.error(`Failed to fetch Substack page: ${response.status} ${response.statusText}`);
        return new Response(
          JSON.stringify({ 
            error: `Failed to fetch: ${response.status}`,
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
      const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : "Fetch failed";
      console.error(`Fetch error: ${fetchErrorMessage}`);
      return new Response(
        JSON.stringify({ 
          error: fetchErrorMessage,
          imageUrl: null,
          publicationName: null,
          tagline: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in fetch-substack-profile:", errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        imageUrl: null,
        publicationName: null,
        tagline: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
