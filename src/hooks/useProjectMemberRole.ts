import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectMemberRole } from "@/lib/access";

/**
 * Resolves the current authenticated user's role inside a given
 * project. Returns `owner` when the user is the project owner (creator),
 * one of the four `project_members.role` values when they're an
 * invited member, or `null` when they have no membership.
 *
 * Used by the workspace to decide whether the editor should mount in
 * comment-only mode (peer_reviewer / cross_chapter_reviewer).
 */
export function useProjectMemberRole(
  projectId: string | null | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["project_member_role", projectId, userId],
    enabled: !!projectId && !!userId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<"owner" | ProjectMemberRole | null> => {
      if (!projectId || !userId) return null;

      // Owner check first — creator.user_id === current user.
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, creator_id, creators!inner(user_id)")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw projectError;
      const ownerId = (project as any)?.creators?.user_id as string | undefined;
      if (ownerId && ownerId === userId) return "owner";

      const { data: member, error: memberError } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();
      if (memberError) throw memberError;
      return (member?.role as ProjectMemberRole | undefined) ?? null;
    },
  });
}
