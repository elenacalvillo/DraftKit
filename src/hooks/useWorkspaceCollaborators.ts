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
  email: string | null,
  guestNumber: number | null,
): string {
  if (name && name.trim()) return name;
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
    const { data: rawCollabs } = await supabase
      .from("workspace_collaborators")
      .select("id, email, role, user_id, invited_at, joined_at")
      .eq("request_id", requestId)
      .order("invited_at", { ascending: true }) as any;

    const collabs = (rawCollabs as Array<{
      id: string; email: string; role: string;
      user_id: string | null; invited_at: string; joined_at: string | null;
    }>) || [];

    // Batch-fetch creator profiles for those with user_id
    const userIds = collabs
      .map(c => c.user_id)
      .filter((uid): uid is string => uid !== null);

    let profileMap: Record<string, { name: string | null; username: string | null; profile_image_url: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("creators")
        .select("user_id, name, username, profile_image_url")
        .in("user_id", userIds) as any;

      if (profiles) {
        for (const p of profiles as Array<{ user_id: string; name: string | null; username: string | null; profile_image_url: string | null }>) {
          profileMap[p.user_id] = {
            name: p.name,
            username: p.username,
            profile_image_url: p.profile_image_url,
          };
        }
      }
    }

    // Assign stable guest numbers based on invite order (only for those without user_id)
    let guestCounter = 0;
    const enriched: Collaborator[] = collabs.map(c => {
      const profile = c.user_id ? profileMap[c.user_id] || null : null;
      const isGuest = !c.user_id;
      if (isGuest) guestCounter++;

      const name = profile?.name || null;
      const guest_number = isGuest ? guestCounter : null;

      return {
        ...c,
        name,
        username: profile?.username || null,
        profile_image_url: profile?.profile_image_url || null,
        guest_number,
        display_name: deriveDisplayName(name, c.email, guest_number),
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
