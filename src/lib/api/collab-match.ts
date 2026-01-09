import { supabase } from "@/integrations/supabase/client";

export interface CollabSuggestion {
  topic: string;
  description: string;
  format: string;
  whyItWorks: string;
}

export interface CollabMatchResult {
  suggestions: CollabSuggestion[];
  creatorThemes: string[];
  visitorThemes: string[];
}

export async function analyzeCollabMatch(
  creatorSubstackUrl: string,
  visitorSubstackUrl: string
): Promise<CollabMatchResult> {
  const { data, error } = await supabase.functions.invoke("analyze-collab-match", {
    body: { creatorSubstackUrl, visitorSubstackUrl },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze collaboration match");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as CollabMatchResult;
}
