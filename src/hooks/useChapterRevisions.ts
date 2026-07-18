import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChapterRevision {
  id: string;
  request_id: string;
  shared_content: string | null;
  editor_name: string | null;
  editor_user_id: string | null;
  created_at: string;
}

/**
 * Lists version-history snapshots for a chapter (most recent first).
 * Snapshots are written server-side by save_workspace_content at most
 * once every 2 minutes, capped at 30 per chapter.
 */
export function useChapterRevisions(requestId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chapter_revisions", requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<ChapterRevision[]> => {
      if (!requestId) return [];
      const { data, error } = await (supabase as any)
        .from("chapter_revisions")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ChapterRevision[];
    },
  });

  const restore = useMutation({
    mutationFn: async (revisionId: string) => {
      const { data, error } = await (supabase as any).rpc(
        "restore_chapter_revision",
        { _revision_id: revisionId },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapter_revisions", requestId] });
    },
  });

  return {
    revisions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    restore,
  };
}
