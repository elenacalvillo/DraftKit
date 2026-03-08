import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useCallback } from "react";

export interface CollabMetric {
  id: string;
  request_id: string;
  snapshot_day: number;
  snapshot_at: string;
  creator_post_url: string | null;
  creator_likes: number | null;
  creator_comments: number | null;
  requester_post_url: string | null;
  requester_likes: number | null;
  requester_comments: number | null;
}

export function useCollabMetrics(requestId: string | undefined) {
  return useQuery({
    queryKey: ["collab-metrics", requestId],
    queryFn: async () => {
      if (!requestId) return [];
      const { data, error } = await supabase
        .from("collab_metrics" as any)
        .select("*")
        .eq("request_id", requestId)
        .order("snapshot_day", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as CollabMetric[];
    },
    enabled: !!requestId,
  });
}

export function useTriggerMetricsSnapshot(requestId: string) {
  const queryClient = useQueryClient();
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async () => {
    setIsCollecting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("fetch-collab-metrics", {
        body: { requestId, snapshotDay: 0 },
      });
      if (fnError) throw fnError;
      // Invalidate the metrics query so UI refreshes
      await queryClient.invalidateQueries({ queryKey: ["collab-metrics", requestId] });
      return data;
    } catch (err: any) {
      setError(err?.message || "Failed to collect metrics");
      throw err;
    } finally {
      setIsCollecting(false);
    }
  }, [requestId, queryClient]);

  return { trigger, isCollecting, error };
}
