// create-google-doc: Creates a Google Doc with draft content using user's OAuth token

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OutlineSection {
  section: string;
  description: string;
  contributor: "creator" | "requester" | "both";
  suggestedLength: string;
}

interface CollabDraft {
  title: string;
  hook: string;
  outline: OutlineSection[];
  talkingPoints: string[];
  suggestedFormat: string;
  toneNotes: string;
  estimatedReadTime: string;
}

interface RequestBody {
  accessToken: string;
  draft: CollabDraft;
  requesterName: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, draft, requesterName }: RequestBody = await req.json();

    if (!accessToken || !draft) {
      return new Response(
        JSON.stringify({ error: "Missing accessToken or draft" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Create a new blank document
    const createResponse = await fetch(
      "https://docs.googleapis.com/v1/documents",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: draft.title,
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Failed to create document:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create Google Doc", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const doc = await createResponse.json();
    const documentId = doc.documentId;

    // Step 2: Build the content to insert
    const contributorLabel = (contributor: "creator" | "requester" | "both") => {
      switch (contributor) {
        case "creator":
          return "You";
        case "requester":
          return requesterName;
        case "both":
          return "Both";
      }
    };

    // Build content sections
    const contentParts: string[] = [];
    
    // Metadata line
    contentParts.push(`Format: ${draft.suggestedFormat} | Estimated Read Time: ${draft.estimatedReadTime}\n\n`);
    
    // Opening Hook
    contentParts.push("— Opening Hook —\n");
    contentParts.push(`${draft.hook}\n\n`);
    
    // Outline
    contentParts.push("— Outline —\n");
    draft.outline.forEach((section, index) => {
      contentParts.push(`${index + 1}. ${section.section} [${contributorLabel(section.contributor)}] (~${section.suggestedLength})\n`);
      contentParts.push(`   ${section.description}\n\n`);
    });
    
    // Talking Points
    contentParts.push("— Talking Points —\n");
    draft.talkingPoints.forEach((point) => {
      contentParts.push(`• ${point}\n`);
    });
    contentParts.push("\n");
    
    // Tone Notes
    contentParts.push("— Tone Notes —\n");
    contentParts.push(`${draft.toneNotes}\n`);

    const fullContent = contentParts.join("");

    // Step 3: Insert content into the document
    // We need to insert after index 1 (after the implicit paragraph)
    const batchUpdateResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: {
                  index: 1,
                },
                text: fullContent,
              },
            },
          ],
        }),
      }
    );

    if (!batchUpdateResponse.ok) {
      const errorText = await batchUpdateResponse.text();
      console.error("Failed to insert content:", errorText);
      // Document was created but content failed - still return the URL
      return new Response(
        JSON.stringify({
          documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
          warning: "Document created but content insertion failed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return new Response(
      JSON.stringify({ documentUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-google-doc:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
