import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "host" | "requester" | "collaborator" | "project_owner";

export interface MyWorkspace {
  request_id: string;
  role_in_workspace: WorkspaceRole;
  status: string;
  is_project_workspace: boolean;
  is_solo: boolean;
  project_id: string | null;
  project_title: string | null;
  chapter_title: string | null;
  chapter_order: number | null;
  message: string | null;
  requested_date: string | null;
  created_at: string;
  approved_at: string | null;
  content_last_edited_at: string | null;
  content_last_edited_by: string | null;
  collab_link: string | null;
  host_creator_id: string;
  host_name: string | null;
  host_username: string | null;
  host_profile_image_url: string | null;
  requester_user_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requester_profile_image_url: string | null;
  joined_at: string | null;
  hidden_by_creator: boolean;
  hidden_by_requester: boolean;
}

export function useMyWorkspaces() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["my_workspaces", user?.id],
    queryFn: async (): Promise<MyWorkspace[]> => {
      const { data, error } = await supabase.rpc("list_my_workspaces");
      if (error) throw error;
      return (data ?? []) as MyWorkspace[];
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

// Bucket a workspace into one of the four Collaborations tabs.
export function bucketWorkspace(w: MyWorkspace): "needs_response" | "active" | "published" | "archived" {
  if (w.status === "published") return "published";
  if (w.status === "declined" || w.status === "cancelled") return "archived";
  if (w.status === "pending") return "needs_response";
  return "active"; // approved
}
