import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ProjectMemberRole } from "@/lib/access";

export type ProjectMember = Tables<"project_members">;

export function useProjectMembers(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["project_members", projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .order("invited_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectMember[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });

  const inviteMember = useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email: string;
      role: ProjectMemberRole;
    }) => {
      if (!projectId) throw new Error("Project ID is required");
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) throw new Error("Email is required");
      const payload: TablesInsert<"project_members"> = {
        project_id: projectId,
        email: trimmed,
        role,
      };
      const { data, error } = await supabase
        .from("project_members")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        // Surface the unique-constraint error in human-readable form.
        if (error.code === "23505") {
          throw new Error("This email has already been invited to the project.");
        }
        throw error;
      }
      return data as ProjectMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_members", projectId] });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: ProjectMemberRole;
    }) => {
      const { data, error } = await supabase
        .from("project_members")
        .update({ role })
        .eq("id", memberId)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProjectMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_members", projectId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_members", projectId] });
    },
  });

  return {
    members: membersQuery.data ?? [],
    isLoading: membersQuery.isLoading,
    error: membersQuery.error,
    inviteMember,
    updateMemberRole,
    removeMember,
  };
}
