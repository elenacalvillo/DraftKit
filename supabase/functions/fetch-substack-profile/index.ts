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
  
  // Try to extract the publication cover photo or author photo
  // Pattern 1: publication-cover-photo class
  const coverPhotoMatch = html.match(/<img[^>]+class="[^"]*publication-cover-photo[^"]*"[^>]+src="([^"]+)"/i);
  if (coverPhotoMatch) {
    result.imageUrl = coverPhotoMatch[1];
  }
  
  // Pattern 2: Look for src before class in img tag
  if (!result.imageUrl) {
    const altCoverMatch = html.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*publication-cover-photo[^"]*"/i);
    if (altCoverMatch) {
      result.imageUrl = altCoverMatch[1];
    }
  }
  
  // Pattern 3: og:image meta tag (usually the publication logo/cover)
  if (!result.imageUrl) {
    const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    if (ogImageMatch) {
      result.imageUrl = ogImageMatch[1];
    }
  }
  
  // Pattern 4: Alternative og:image format
  if (!result.imageUrl) {
    const ogImageAlt = html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogImageAlt) {
      result.imageUrl = ogImageAlt[1];
    }
  }
  
  // Extract publication name from og:site_name or title
  const siteNameMatch = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i);
  if (siteNameMatch) {
    result.publicationName = siteNameMatch[1];
  } else {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.publicationName = titleMatch[1].split("|")[0].trim();
    }
  }
  
  // Extract tagline/description
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  if (descMatch) {
    result.tagline = descMatch[1];
  } else {
    const ogDescMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
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
