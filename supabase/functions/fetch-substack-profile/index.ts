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
  
  // Handle profile format: substack.com/@username
  const profileMatch = normalized.match(/substack\.com\/@([a-zA-Z0-9_-]+)/i);
  if (profileMatch) {
    normalized = `https://${profileMatch[1]}.substack.com`;
  }
  
  // Handle just username
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { substackUrl } = await req.json();
    
    if (!substackUrl) {
      return new Response(
        JSON.stringify({ error: "substackUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const normalizedUrl = normalizeSubstackUrl(substackUrl);
    console.log(`Fetching Substack profile from: ${normalizedUrl}`);
    
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CollabBot/1.0)",
        "Accept": "text/html",
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch Substack page: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch Substack page",
          imageUrl: null,
          publicationName: null,
          tagline: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const html = await response.text();
    const profileData = extractProfileData(html);
    
    console.log(`Extracted profile data:`, profileData);
    
    return new Response(
      JSON.stringify(profileData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching Substack profile:", errorMessage);
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
