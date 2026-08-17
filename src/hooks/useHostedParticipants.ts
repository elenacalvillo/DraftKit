import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface HostedParticipant {
  request_id: string;
  email: string;
  user_id: string | null;
  name: string | null;
  joined_at: string | null;
  source: string;
}

/**
 * Participants of every workspace the signed-in user hosts or owns.
 * Powers the Pending/Joined badges and invited-email lines in the
 * Collaborations list so hosts never have to guess who is in what state.
 */
export function useHostedParticipants() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["hosted_participants", user?.id],
    queryFn: async (): Promise<HostedParticipant[]> => {
      const { data, error } = await supabase.rpc("list_my_hosted_participants");
      if (error) throw error;
      return (data ?? []) as HostedParticipant[];
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 60 * 1000,
    retry: false,
  });

  const byRequest = useMemo(() => {
    const map = new Map<string, HostedParticipant[]>();
    for (const p of query.data ?? []) {
      const list = map.get(p.request_id) ?? [];
      list.push(p);
      map.set(p.request_id, list);
    }
    return map;
  }, [query.data]);

  return {
    participants: query.data ?? [],
    byRequest,
    isLoading: query.isLoading,
  };
}
