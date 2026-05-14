import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { CHAPTER_STATUSES, type ChapterStatus } from "@/lib/access";
import { useAuth } from "./useAuth";

export type Chapter = Tables<"collab_requests">;

/** Type-narrow a collab_requests row's status to ChapterStatus when it
 *  is a project workspace. */
export function asChapterStatus(value: string | null | undefined): ChapterStatus {
  if (CHAPTER_STATUSES.includes(value as ChapterStatus)) {
    return value as ChapterStatus;
  }
  return "Draft";
}

export function useProjectChapters(projectId: string | undefined) {
  const { creator, user } = useAuth();
  const queryClient = useQueryClient();

  const chaptersQuery = useQuery({
    queryKey: ["project_chapters", projectId],
    queryFn: async (): Promise<Chapter[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("collab_requests")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_project_workspace", true)
        .order("chapter_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chapter[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });

  const createChapter = useMutation({
    mutationFn: async (input: { title: string }) => {
      if (!projectId) throw new Error("Project ID is required");
      if (!creator?.id) throw new Error("Creator ID is required");
      if (!user?.email) throw new Error("User email is required");
      const trimmed = input.title.trim();
      if (!trimmed) throw new Error("Chapter title is required");

      // Determine next chapter order.
      const next =
        (chaptersQuery.data ?? []).reduce((max, ch) => {
          return Math.max(max, ch.chapter_order ?? 0);
        }, 0) + 1;

      const payload: TablesInsert<"collab_requests"> = {
        creator_id: creator.id,
        project_id: projectId,
        is_project_workspace: true,
        chapter_order: next,
        is_solo: true,
        message: trimmed,
        requester_email: user.email,
        requester_name: creator.name ?? user.email,
        status: "Draft",
      };
      const { data, error } = await supabase
        .from("collab_requests")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        // Surface a friendly message when RLS blocks the insert (Postgres 42501).
        // The raw PostgREST error ("No API key found in request" / generic 401)
        // is misleading and previously hid the real "Add chapter" failure.
        console.error("[useProjectChapters] createChapter failed", error);
        if ((error as { code?: string }).code === "42501") {
          throw new Error(
            "You don't have permission to add a chapter to this project.",
          );
        }
        throw error;
      }
      return data as Chapter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_chapters", projectId] });
    },
  });

  const updateChapterStatus = useMutation({
    mutationFn: async ({
      chapterId,
      status,
    }: {
      chapterId: string;
      status: ChapterStatus;
    }) => {
      const { data, error } = await supabase
        .from("collab_requests")
        .update({ status })
        .eq("id", chapterId)
        .select("*")
        .single();
      if (error) throw error;
      return data as Chapter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_chapters", projectId] });
    },
  });

  const reorderChapters = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Issue updates sequentially — small N (book chapters), no
      // transaction wrapper required for v1.
      for (let i = 0; i < orderedIds.length; i += 1) {
        const { error } = await supabase
          .from("collab_requests")
          .update({ chapter_order: i + 1 })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_chapters", projectId] });
    },
  });

  const assignWriter = useMutation({
    mutationFn: async ({
      chapterId,
      writerUserId,
      writerEmail,
      writerName,
    }: {
      chapterId: string;
      writerUserId: string | null;
      writerEmail: string;
      writerName: string;
    }) => {
      const { data, error } = await supabase
        .from("collab_requests")
        .update({
          requester_user_id: writerUserId,
          requester_email: writerEmail,
          requester_name: writerName,
        })
        .eq("id", chapterId)
        .select("*")
        .single();
      if (error) throw error;
      return data as Chapter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_chapters", projectId] });
    },
  });

  return {
    chapters: chaptersQuery.data ?? [],
    isLoading: chaptersQuery.isLoading,
    error: chaptersQuery.error,
    createChapter,
    updateChapterStatus,
    reorderChapters,
    assignWriter,
  };
}
