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

  // Notifies the invitee that they now have project access. Best effort:
  // the member row is already written, so a mail failure must not roll back.
  const sendInviteEmail = async (email: string) => {
    if (!projectId) return;
    const { error } = await supabase.functions.invoke("send-project-invite", {
      body: { projectId, email },
    });
    if (error) throw error;
  };

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
        throw new Error(error.message || "Invite failed");
      }

      let emailed = true;
      try {
        await sendInviteEmail(trimmed);
      } catch {
        emailed = false;
      }
      return { member: data as ProjectMember, emailed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_members", projectId] });
    },
  });

  // Adds a registered DraftKit writer by profile. The RPC resolves their
  // account email server-side so the host never has to guess an address.
  const addMemberByCreator = useMutation({
    mutationFn: async ({
      creatorId,
      role,
    }: {
      creatorId: string;
      role: ProjectMemberRole;
    }) => {
      if (!projectId) throw new Error("Project ID is required");
      const { data, error } = await supabase.rpc(
        "add_project_member_by_creator",
        { _project_id: projectId, _creator_id: creatorId, _role: role },
      );
      if (error) throw new Error(error.message || "Could not add writer");
      const row = (data ?? [])[0];
      const member = row
        ? ({
            id: row.out_id,
            project_id: row.out_project_id,
            user_id: row.out_user_id,
            email: row.out_email,
            role: row.out_role,
            invited_at: row.out_invited_at,
            joined_at: row.out_joined_at,
            invited_by: null,
          } as ProjectMember)
        : (undefined as unknown as ProjectMember);

      let emailed = true;
      try {
        if (member?.email) await sendInviteEmail(member.email);
      } catch {
        emailed = false;
      }
      return { member, emailed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_members", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project_people", projectId] });
    },
  });

  // Re-notifies anyone still pending (including backfilled chapter authors
  // who were added before project invites sent email).
  const resendInvite = useMutation({
    mutationFn: async (email: string) => {
      await sendInviteEmail(email);
      return email;
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
    addMemberByCreator,
    resendInvite,


    updateMemberRole,
    removeMember,
  };
}
