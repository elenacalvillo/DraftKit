import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CollaboratorWorkspace {
  request_id: string;
  role: string | null;
  joined_at: string | null;
  status: string;
  is_project_workspace: boolean;
  project_id: string | null;
  project_title: string | null;
  chapter_title: string | null;
  chapter_order: number | null;
  content_last_edited_at: string | null;
  content_last_edited_by: string | null;
  host_name: string | null;
  host_username: string | null;
  host_profile_image_url: string | null;
}

export function useCollaboratorWorkspaces() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["collaborator_workspaces", user?.id],
    queryFn: async (): Promise<CollaboratorWorkspace[]> => {
      const { data, error } = await supabase.rpc("list_my_collaborator_workspaces");
      if (error) throw error;
      return (data ?? []) as CollaboratorWorkspace[];
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 30_000,
  });

  return {
    workspaces: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}