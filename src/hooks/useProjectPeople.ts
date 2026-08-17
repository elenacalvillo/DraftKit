import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectPerson {
  request_id: string;
  chapter_title: string | null;
  chapter_order: number | null;
  email: string;
  user_id: string | null;
  name: string | null;
  username: string | null;
  profile_image_url: string | null;
  joined_at: string | null;
  source: string;
  is_project_member: boolean;
}

/**
 * Everyone involved across a project's chapter workspaces.
 * Owner/admin only (enforced by the RPC).
 */
export function useProjectPeople(projectId: string | undefined) {
  const query = useQuery({
    queryKey: ["project_people", projectId],
    queryFn: async (): Promise<ProjectPerson[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase.rpc("list_project_people", {
        _project_id: projectId,
      });
      if (error) throw error;
      return (data ?? []) as ProjectPerson[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
    retry: false,
  });

  return {
    people: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
