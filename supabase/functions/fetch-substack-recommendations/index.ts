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

const UA = "Mozilla/5.0 (compatible; DraftKit/1.0; +https://draftkit.app)";

/** Resolve a subdomain to a Substack publication ID */
async function resolvePublicationId(subdomain: string): Promise<number | null> {
  const searchUrl = `https://substack.com/api/v1/publication/search?query=${encodeURIComponent(subdomain)}`;
  console.log(`Resolving publication ID via: ${searchUrl}`);
  const res = await fetch(searchUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`Search API returned ${res.status}`);
    return null;
  }
  const data = await res.json();
  // Handle both array (legacy) and object with results array (current)
  const publications = Array.isArray(data) ? data : (data?.results || data?.publications || []);
  console.log(`Search returned ${Array.isArray(data) ? 'array' : 'object'} with ${publications.length} candidates`);
  if (!Array.isArray(publications) || publications.length === 0) return null;
  // Exact subdomain match first
  const exact = publications.find(
    (p: any) => p.subdomain?.toLowerCase() === subdomain.toLowerCase()
  );
  if (exact?.id) return exact.id;
  // Fallback to first result with a valid id
  if (publications[0]?.id) return publications[0].id;
  return null;
}

interface RecommendationResult {
  subdomain: string;
  name: string;
  author_name: string | null;
  description: string | null;
  logo_url: string | null;
}

/** Fetch recommendations using Substack's public API */
async function fetchRecommendationsApi(
  publicationId: number
): Promise<RecommendationResult[]> {
  const apiUrl = `https://substack.com/api/v1/recommendations/from/${publicationId}`;
  console.log(`Fetching recommendations from: ${apiUrl}`);
  const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`Recommendations API returned ${res.status}`);
    return [];
  }
  const data = await res.json();
  const items = Array.isArray(data) ? data : data?.recommendations || [];
  const results: RecommendationResult[] = [];

  for (const item of items) {
    const pub = item.recommendedPublication || item;
    const sd = pub.subdomain || pub.custom_domain_optional;
    if (!sd) continue;
    results.push({
      subdomain: sd,
      name: pub.name || sd,
      author_name: pub.author_name || pub.author?.name || null,
      description: pub.hero_text || pub.description || null,
      logo_url: pub.logo_url || pub.author?.photo_url || null,
    });
  }
  return results;
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
      .select("id, substack_url, newsletter_url, username")
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

    const substackUrl = creator.newsletter_url || creator.substack_url;
    if (!substackUrl) {
      return new Response(
        JSON.stringify({ error: "No Substack URL configured", recommendations: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const subdomain = extractSubdomain(substackUrl);
    if (!subdomain) {
      return new Response(
        JSON.stringify({ error: "Invalid Substack URL format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Resolved subdomain: ${subdomain}`);

    // Step 1: Resolve publication ID
    const pubId = await resolvePublicationId(subdomain);
    if (!pubId) {
      return new Response(
        JSON.stringify({
          error: `Could not find Substack publication for "${subdomain}"`,
          recommendations: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`Publication ID: ${pubId}`);

    // Step 2: Fetch recommendations via API
    const parsedRecs = await fetchRecommendationsApi(pubId);
    console.log(`Fetched ${parsedRecs.length} recommendations via API`);

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
