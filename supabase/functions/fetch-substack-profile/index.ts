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

function extractProfileData(html: string): SubstackProfile {
  const result: SubstackProfile = {
    imageUrl: null,
    publicationName: null,
    tagline: null,
  };
  
  // Pattern 1: twitter:image meta tag (most reliable for profile images)
  const twitterImageMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i) ||
                           html.match(/<meta[^>]+content="([^"]+)"[^>]+name="twitter:image"/i);
  if (twitterImageMatch) {
    result.imageUrl = twitterImageMatch[1];
    console.log("Found image via twitter:image meta tag");
  }
  
  // Pattern 2: og:image meta tag (usually the publication logo/cover)
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
  
  // Pattern 4: Look for image in JSON-LD structured data
  if (!result.imageUrl) {
    const jsonLdMatch = html.match(/"image"\s*:\s*"(https:\/\/[^"]+)"/i);
    if (jsonLdMatch && jsonLdMatch[1].includes("substack")) {
      result.imageUrl = jsonLdMatch[1];
      console.log("Found image via JSON-LD");
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
      
      const profileData = extractProfileData(html);
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
