import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract subdomain from various Substack URL formats */
function extractSubdomain(substackUrl: string): string | null {
  try {
    const raw = substackUrl.replace(/\?+$/, "");
    const u = raw.startsWith("http") ? raw : `https://${raw}`;
    const parsed = new URL(u);
    if (
      parsed.hostname === "substack.com" ||
      parsed.hostname === "www.substack.com"
    ) {
      const m = parsed.pathname.match(/^\/@([^/?]+)/);
      return m ? m[1] : null;
    }
    return parsed.hostname.replace(".substack.com", "");
  } catch {
    return null;
  }
}

interface ParsedRec {
  subdomain: string;
  name: string;
  author_name: string | null;
  description: string | null;
  logo_url: string | null;
}

/** Parse recommendations from the /recommendations HTML page */
function parseRecommendationsHtml(html: string): ParsedRec[] {
  const results: ParsedRec[] = [];
  
  // Look for JSON data in __NEXT_DATA__ or window._preloads
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const recs =
        data?.props?.pageProps?.recommendations ||
        data?.props?.pageProps?.initialRecommendations ||
        [];
      for (const rec of recs) {
        const sd =
          rec.subdomain ||
          (rec.publication_url
            ? extractSubdomain(rec.publication_url)
            : null);
        if (!sd) continue;
        results.push({
          subdomain: sd,
          name: rec.name || rec.publication_name || sd,
          author_name: rec.author_name || rec.byline || null,
          description: rec.description || rec.tagline || null,
          logo_url: rec.logo_url || rec.photo_url || null,
        });
      }
      if (results.length > 0) return results;
    } catch {
      // Fall through to HTML parsing
    }
  }

  // Fallback: parse recommendation links from HTML
  // Pattern: links like https://buildtolaunch.substack.com/?utm_source=recommendations_page
  // with names in nearby alt text or link text
  const linkRegex =
    /\[([^\]]*?)\]\((https?:\/\/([a-z0-9-]+)\.substack\.com\/?\?utm_source=recommendations_page[^)]*)\)/g;
  const seen = new Set<string>();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const linkText = match[1];
    const sd = match[3];
    if (seen.has(sd)) continue;
    seen.add(sd);

    // Skip image-only links (logo references)
    if (linkText.startsWith("http") || linkText.includes("substackcdn")) continue;

    results.push({
      subdomain: sd,
      name: linkText.trim(),
      author_name: null,
      description: null,
      logo_url: null,
    });
  }

  // Also match custom domain recommendations: www.toxsec.com etc
  // These come as (https://www.domain.com/?utm_source=recommendations_page...)
  // We can't easily map those to subdomains, skip for now

  return results;
}

/** Parse description text that follows a recommendation link */
function enrichWithDescriptions(
  html: string,
  recs: ParsedRec[]
): ParsedRec[] {
  for (const rec of recs) {
    // Look for description text after the subscribe button for this subdomain
    const pattern = new RegExp(
      `${rec.subdomain}\\.substack\\.com\\/\\?utm_source=recommendations_page[^)]*\\)\\s*Subscribe\\s*\\n\\n([^\\n]+)`,
      "i"
    );
    const m = html.match(pattern);
    if (m && m[1] && !m[1].startsWith("[") && !m[1].startsWith("\\")) {
      rec.description = m[1].trim();
    }

    // Look for "By AuthorName" pattern
    const byPattern = new RegExp(
      `${rec.subdomain}\\.substack\\.com[^)]*\\)\\s*Subscribe[\\s\\S]*?By ([^\\]\\n]+?)\\]`,
      "i"
    );
    const byMatch = html.match(byPattern);
    if (byMatch && byMatch[1]) {
      rec.author_name = byMatch[1].trim();
    }

    // Look for logo URL in nearby image
    const logoPattern = new RegExp(
      `\\!\\[(?:${rec.name}|User's avatar)\\]\\((https://substackcdn\\.com/[^)]+)\\)\\\\\\n\\\\\\n${rec.name}`,
      "i"
    );
    const logoMatch = html.match(logoPattern);
    if (logoMatch && logoMatch[1]) {
      // Extract the original image URL from the Substack CDN wrapper
      const cdnUrl = logoMatch[1];
      const origMatch = cdnUrl.match(/https%3A%2F%2F(.+?)(?:\)|$)/);
      if (origMatch) {
        rec.logo_url = decodeURIComponent(
          `https://${origMatch[1]}`
        ).replace(/\)$/, "");
      } else {
        rec.logo_url = cdnUrl;
      }
    }
  }
  return recs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get creator
    const { data: creator, error: creatorErr } = await serviceClient
      .from("creators")
      .select("id, substack_url, username")
      .eq("user_id", userId)
      .maybeSingle();

    if (creatorErr || !creator) {
      return new Response(
        JSON.stringify({ error: "Creator profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!creator.substack_url) {
      return new Response(
        JSON.stringify({ error: "No Substack URL configured", recommendations: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const subdomain = extractSubdomain(creator.substack_url);
    if (!subdomain) {
      return new Response(
        JSON.stringify({ error: "Invalid Substack URL format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch the recommendations HTML page
    const recsPageUrl = `https://${subdomain}.substack.com/recommendations`;
    console.log(`Fetching recommendations page: ${recsPageUrl}`);

    const recsResponse = await fetch(recsPageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DraftKit/1.0; +https://draftkit.app)",
        Accept: "text/html",
      },
    });

    if (!recsResponse.ok) {
      const body = await recsResponse.text();
      console.error(`Page fetch error: ${recsResponse.status}`, body);
      return new Response(
        JSON.stringify({
          error: "Could not fetch recommendations from Substack",
          recommendations: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const html = await recsResponse.text();
    let parsedRecs = parseRecommendationsHtml(html);
    parsedRecs = enrichWithDescriptions(html, parsedRecs);

    console.log(`Parsed ${parsedRecs.length} recommendations`);

    // Build DraftKit creator map for cross-referencing
    const { data: existingCreators } = await serviceClient
      .from("creators")
      .select("id, substack_url, username, name, profile_image_url")
      .not("substack_url", "is", null);

    const creatorBySubdomain = new Map<
      string,
      {
        id: string;
        username: string;
        name: string;
        profile_image_url: string | null;
      }
    >();
    for (const c of existingCreators || []) {
      if (c.substack_url) {
        const sd = extractSubdomain(c.substack_url);
        if (sd) {
          creatorBySubdomain.set(sd.toLowerCase(), {
            id: c.id,
            username: c.username,
            name: c.name,
            profile_image_url: c.profile_image_url,
          });
        }
      }
    }

    const results: any[] = [];

    for (const rec of parsedRecs) {
      // Upsert into discovered_publications
      const { data: pub, error: pubErr } = await serviceClient
        .from("discovered_publications")
        .upsert(
          {
            subdomain: rec.subdomain,
            name: rec.name,
            author_name: rec.author_name,
            description: rec.description,
            logo_url: rec.logo_url,
          },
          { onConflict: "subdomain" }
        )
        .select("id")
        .single();

      if (pubErr || !pub) {
        console.error(
          `Failed to upsert publication ${rec.subdomain}:`,
          pubErr
        );
        continue;
      }

      // Link to creator
      await serviceClient.from("creator_recommendations").upsert(
        {
          creator_id: creator.id,
          publication_id: pub.id,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "creator_id,publication_id" }
      );

      const dkCreator = creatorBySubdomain.get(rec.subdomain.toLowerCase());

      results.push({
        id: pub.id,
        subdomain: rec.subdomain,
        name: rec.name,
        author_name: rec.author_name,
        description: rec.description,
        logo_url: rec.logo_url,
        isOnDraftKit: !!dkCreator,
        draftKitUsername: dkCreator?.username || null,
        draftKitName: dkCreator?.name || null,
        draftKitProfileImage: dkCreator?.profile_image_url || null,
      });
    }

    return new Response(JSON.stringify({ recommendations: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
