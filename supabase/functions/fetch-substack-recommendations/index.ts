import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify the user
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

    // Service-role client for writes
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the creator's substack_url
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
        JSON.stringify({
          error: "No Substack URL configured",
          recommendations: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract subdomain from substack_url
    // Formats: "https://name.substack.com", "name.substack.com",
    //          "https://substack.com/@name", "substack.com/@name"
    let subdomain: string;
    try {
      const rawUrl = creator.substack_url.startsWith("http")
        ? creator.substack_url
        : `https://${creator.substack_url}`;
      const parsed = new URL(rawUrl);

      if (parsed.hostname === "substack.com" || parsed.hostname === "www.substack.com") {
        // Profile URL format: substack.com/@username
        const match = parsed.pathname.match(/^\/@([^/?]+)/);
        if (match) {
          subdomain = match[1];
        } else {
          throw new Error("Could not extract username from profile URL");
        }
      } else {
        // Publication URL format: name.substack.com
        subdomain = parsed.hostname.replace(".substack.com", "");
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid Substack URL format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch recommendations from Substack API
    const recsUrl = `https://${subdomain}.substack.com/api/v1/recommendations`;
    console.log(`Fetching recommendations from: ${recsUrl}`);

    const recsResponse = await fetch(recsUrl, {
      headers: { "User-Agent": "DraftKit/1.0" },
    });

    if (!recsResponse.ok) {
      console.error(
        `Substack API error: ${recsResponse.status} ${recsResponse.statusText}`
      );
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

    const recsData = await recsResponse.json();

    // The API may return an array directly or wrapped in an object
    const recommendations: any[] = Array.isArray(recsData)
      ? recsData
      : recsData.recommendations || recsData.data || [];

    console.log(`Found ${recommendations.length} recommendations`);

    // Get all existing DraftKit creators' substack subdomains for matching
    const { data: existingCreators } = await serviceClient
      .from("creators")
      .select("id, substack_url, username, name, profile_image_url")
      .not("substack_url", "is", null);

    const creatorBySubdomain = new Map<
      string,
      { id: string; username: string; name: string; profile_image_url: string | null }
    >();
    for (const c of existingCreators || []) {
      if (c.substack_url) {
        try {
          const raw = c.substack_url.replace(/\?+$/, ""); // strip trailing ?
          const u = raw.startsWith("http") ? raw : `https://${raw}`;
          const parsed = new URL(u);
          let sd: string;
          if (parsed.hostname === "substack.com" || parsed.hostname === "www.substack.com") {
            const m = parsed.pathname.match(/^\/@([^/?]+)/);
            sd = m ? m[1] : parsed.pathname.replace(/^\//, "");
          } else {
            sd = parsed.hostname.replace(".substack.com", "");
          }
          creatorBySubdomain.set(sd.toLowerCase(), {
            id: c.id,
            username: c.username,
            name: c.name,
            profile_image_url: c.profile_image_url,
          });
        } catch {
          // skip invalid URLs
        }
      }
    }

    const results: any[] = [];

    for (const rec of recommendations) {
      // Substack API returns various shapes; normalize
      const recSubdomain =
        rec.subdomain ||
        rec.publication_subdomain ||
        (rec.publication_url
          ? new URL(
              rec.publication_url.startsWith("http")
                ? rec.publication_url
                : `https://${rec.publication_url}`
            ).hostname.replace(".substack.com", "")
          : null);

      if (!recSubdomain) continue;

      const pubName =
        rec.name || rec.publication_name || rec.title || recSubdomain;
      const authorName =
        rec.author_name ||
        rec.author?.name ||
        rec.byline ||
        null;
      const description =
        rec.description ||
        rec.tagline ||
        rec.short_description ||
        null;
      const logoUrl =
        rec.logo_url ||
        rec.author_photo_url ||
        rec.publication_logo_url ||
        rec.photo_url ||
        null;
      const subscriberCount =
        rec.subscriber_count || rec.subscribers || null;
      const language = rec.language || null;

      // Upsert into discovered_publications
      const { data: pub, error: pubErr } = await serviceClient
        .from("discovered_publications")
        .upsert(
          {
            subdomain: recSubdomain,
            name: pubName,
            author_name: authorName,
            description,
            logo_url: logoUrl,
            subscriber_count: subscriberCount,
            language,
          },
          { onConflict: "subdomain" }
        )
        .select("id")
        .single();

      if (pubErr || !pub) {
        console.error(`Failed to upsert publication ${recSubdomain}:`, pubErr);
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

      // Check if on DraftKit
      const dkCreator = creatorBySubdomain.get(recSubdomain);

      results.push({
        id: pub.id,
        subdomain: recSubdomain,
        name: pubName,
        author_name: authorName,
        description,
        logo_url: logoUrl,
        subscriber_count: subscriberCount,
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
