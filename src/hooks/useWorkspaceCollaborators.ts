import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Collaborator {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  invited_at: string;
  joined_at: string | null;
  // Enriched from public_creator_profiles
  name: string | null;
  username: string | null;
  profile_image_url: string | null;
  // Stable guest number for email-only invites
  guest_number: number | null;
  // Best display name: creator name → capitalized email local-part → "Guest #N"
  display_name: string;
}

function deriveDisplayName(
  name: string | null,
  username: string | null,
  email: string | null,
  guestNumber: number | null,
): string {
  if (name && name.trim()) return name;
  // A registered account with no display name shows its handle, never a guess
  // built from the email address.
  if (username && username.trim()) return `@${username}`;
  if (email) {
    const local = email.split("@")[0];
    if (local) {
      // "farida.smith" → "Farida Smith", "john_doe" → "John Doe"
      return local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
    }
  }
  return guestNumber != null ? `Guest ${guestNumber}` : "Guest";
}

export function useWorkspaceCollaborators(requestId: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollaborators = useCallback(async () => {
    // SECURITY DEFINER RPC: the private creators table only ever returns the
    // caller's own row, so client-side enrichment silently lost every other
    // participant's real name. The RPC gates on has_workspace_access.
    const { data: rawCollabs } = await supabase
      .rpc("list_workspace_participants", { _request_id: requestId }) as any;

    const collabs = (rawCollabs as Array<{
      id: string; email: string; role: string;
      user_id: string | null; invited_at: string; joined_at: string | null;
      name: string | null; username: string | null; profile_image_url: string | null;
    }>) || [];

    // Assign stable guest numbers based on invite order (only for those without user_id)
    let guestCounter = 0;
    const enriched: Collaborator[] = collabs.map(c => {
      const isGuest = !c.user_id;
      if (isGuest) guestCounter++;

      const guest_number = isGuest ? guestCounter : null;

      return {
        id: c.id,
        email: c.email,
        role: c.role,
        user_id: c.user_id,
        invited_at: c.invited_at,
        joined_at: c.joined_at,
        name: c.name ?? null,
        username: c.username ?? null,
        profile_image_url: c.profile_image_url ?? null,
        guest_number,
        display_name: deriveDisplayName(c.name ?? null, c.username ?? null, c.email, guest_number),
      };
    });


    setCollaborators(enriched);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  // Realtime: refetch when a collaborator row changes (e.g., user_id linked on signup)
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`workspace-collabs-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_collaborators",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          fetchCollaborators();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, fetchCollaborators]);

  return { collaborators, loading, refetch: fetchCollaborators };
}
