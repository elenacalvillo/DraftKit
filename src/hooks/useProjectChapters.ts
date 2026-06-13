import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { CHAPTER_STAGES, type ChapterStage } from "@/lib/access";
import { useAuth } from "./useAuth";

export type Chapter = Tables<"collab_requests">;

/** Slim row used by the project dashboard list — excludes heavy HTML/JSON. */
const CHAPTER_LIST_COLUMNS =
  "id, project_id, creator_id, message, chapter_order, chapter_stage, status, requester_user_id, requester_email, requester_name, requester_profile_image_url, is_project_workspace, is_solo, created_at";

export type ChapterListItem = Pick<
  Chapter,
  | "id"
  | "project_id"
  | "creator_id"
  | "message"
  | "chapter_order"
  | "chapter_stage"
  | "status"
  | "requester_user_id"
  | "requester_email"
  | "requester_name"
  | "requester_profile_image_url"
  | "is_project_workspace"
  | "is_solo"
  | "created_at"
>;

/** Type-narrow a collab_requests row's chapter_stage to ChapterStage. */
export function asChapterStage(value: string | null | undefined): ChapterStage {
  if (value && (CHAPTER_STAGES as readonly string[]).includes(value)) {
    return value as ChapterStage;
  }
  return "draft";
}

export function useProjectChapters(projectId: string | undefined) {
  const { creator, user } = useAuth();
  const queryClient = useQueryClient();

  const chaptersQuery = useQuery({
    queryKey: ["project_chapters", projectId],
    queryFn: async (): Promise<ChapterListItem[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("collab_requests")
        .select(CHAPTER_LIST_COLUMNS)
        .eq("project_id", projectId)
        .eq("is_project_workspace", true)
        .order("chapter_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChapterListItem[];
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
        requester_user_id: user.id,
        requester_email: user.email,
        requester_name: creator.name ?? user.email,
        // Reuse the collaboration "approved" lifecycle so existing
        // workspace access + edit policies apply unchanged. The book
        // workflow stage lives in chapter_stage.
        status: "approved",
        chapter_stage: "draft",
      };
      const { data, error } = await supabase
        .from("collab_requests")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
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

  const updateChapterStage = useMutation({
    mutationFn: async ({
      chapterId,
      stage,
    }: {
      chapterId: string;
      stage: ChapterStage;
    }) => {
      const { data, error } = await supabase
        .from("collab_requests")
        .update({ chapter_stage: stage })
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
      const current = chaptersQuery.data ?? [];
      const currentOrderById = new Map(
        current.map((c) => [c.id, c.chapter_order ?? 0]),
      );
      const updates = orderedIds
        .map((id, i) => ({ id, next: i + 1 }))
        .filter(({ id, next }) => currentOrderById.get(id) !== next);
      await Promise.all(
        updates.map(({ id, next }) =>
          supabase
            .from("collab_requests")
            .update({ chapter_order: next })
            .eq("id", id)
            .then(({ error }) => {
              if (error) throw error;
            }),
        ),
      );
    },
    onMutate: async (orderedIds: string[]) => {
      const key = ["project_chapters", projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChapterListItem[]>(key);
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]));
        const next = orderedIds
          .map((id, i) => {
            const row = byId.get(id);
            return row ? { ...row, chapter_order: i + 1 } : null;
          })
          .filter((r): r is Chapter => r !== null);
        queryClient.setQueryData<ChapterListItem[]>(key, next);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["project_chapters", projectId], ctx.previous);
      }
    },
  });

  const swapChapters = useMutation({
    mutationFn: async ({
      aId,
      bId,
      aOrder,
      bOrder,
    }: {
      aId: string;
      bId: string;
      aOrder: number;
      bOrder: number;
    }) => {
      await Promise.all([
        supabase
          .from("collab_requests")
          .update({ chapter_order: bOrder })
          .eq("id", aId)
          .then(({ error }) => {
            if (error) throw error;
          }),
        supabase
          .from("collab_requests")
          .update({ chapter_order: aOrder })
          .eq("id", bId)
          .then(({ error }) => {
            if (error) throw error;
          }),
      ]);
    },
    onMutate: async ({ aId, bId }) => {
      const key = ["project_chapters", projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChapterListItem[]>(key);
      if (previous) {
        const aIdx = previous.findIndex((c) => c.id === aId);
        const bIdx = previous.findIndex((c) => c.id === bId);
        if (aIdx >= 0 && bIdx >= 0) {
          const next = [...previous];
          const aOld = next[aIdx].chapter_order;
          const bOld = next[bIdx].chapter_order;
          next[aIdx] = { ...next[aIdx], chapter_order: bOld };
          next[bIdx] = { ...next[bIdx], chapter_order: aOld };
          next.sort(
            (x, y) => (x.chapter_order ?? 0) - (y.chapter_order ?? 0),
          );
          queryClient.setQueryData<ChapterListItem[]>(key, next);
        }
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["project_chapters", projectId], ctx.previous);
      }
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

  const deleteChapter = useMutation({
    mutationFn: async ({ chapterId }: { chapterId: string }) => {
      const { error } = await supabase
        .from("collab_requests")
        .delete()
        .eq("id", chapterId);
      if (error) throw error;
    },
    onMutate: async ({ chapterId }) => {
      const key = ["project_chapters", projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChapterListItem[]>(key);
      if (previous) {
        queryClient.setQueryData<ChapterListItem[]>(
          key,
          previous.filter((c) => c.id !== chapterId),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["project_chapters", projectId], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project_chapters", projectId] });
    },
  });

  return {
    chapters: chaptersQuery.data ?? [],
    isLoading: chaptersQuery.isLoading,
    error: chaptersQuery.error,
    createChapter,
    updateChapterStage,
    reorderChapters,
    swapChapters,
    assignWriter,
    deleteChapter,
  };
}
