import { supabase } from "@/integrations/supabase/client";

export interface CollabSuggestion {
  topic: string;
  description: string;
  format: string;
  whyItWorks: string;
}

export interface ArticleSource {
  title: string;
  author?: string | null;
  relevance: string;
}

export interface SourcesUsed {
  creatorArticles: ArticleSource[];
  visitorArticles: ArticleSource[];
}

export interface CollabMatchResult {
  suggestions: CollabSuggestion[];
  creatorThemes: string[];
  visitorThemes: string[];
  sourcesUsed?: SourcesUsed | null;
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
