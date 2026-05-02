import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProjectBroadcast = Tables<"project_broadcasts">;

/**
 * Hook for sending and viewing broadcasts (announcements) within a
 * book project. Sending happens via the `project-broadcast` Edge
 * Function so emails go out and the row is logged with service-role
 * privileges.
 */
export function useProjectBroadcasts(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const broadcastsQuery = useQuery({
    queryKey: ["project_broadcasts", projectId],
    queryFn: async (): Promise<ProjectBroadcast[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_broadcasts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectBroadcast[];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });

  const sendBroadcast = useMutation({
    mutationFn: async (message: string) => {
      if (!projectId) throw new Error("Project ID is required");
      const trimmed = message.trim();
      if (!trimmed) throw new Error("Broadcast message cannot be empty");

      const { data, error } = await supabase.functions.invoke(
        "project-broadcast",
        {
          body: { projectId, message: trimmed },
        },
      );
      if (error) throw error;
      return data as { recipientCount: number; broadcastId: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_broadcasts", projectId] });
    },
  });

  return {
    broadcasts: broadcastsQuery.data ?? [],
    isLoading: broadcastsQuery.isLoading,
    error: broadcastsQuery.error,
    sendBroadcast,
  };
}
