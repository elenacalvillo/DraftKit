import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectViewerRole } from "@/lib/access";

/**
 * The signed-in user's role in a project: `owner`, one of the
 * project_members roles, or `null` when they have no membership.
 * Resolved by the same database function every access rule uses.
 */
export function useProjectMemberRole(
  projectId: string | null | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["project_member_role", projectId, userId],
    enabled: !!projectId && !!userId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ProjectViewerRole | null> => {
      if (!projectId || !userId) return null;
      const { data, error } = await supabase.rpc("my_project_role", {
        _project_id: projectId,
      });
      if (error) throw error;
      return (data as ProjectViewerRole | null) ?? null;
    },
  });
}
