import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function useActiveCollabs() {
  const { creator } = useAuth();
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["activeCollabs", creator?.id],
    queryFn: async () => {
      if (!creator?.id) return { count: 0 };
      
      const { count, error } = await supabase
        .from('collab_requests')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creator.id)
        .eq('status', 'approved');
      
      if (error) {
        console.error("Error counting active collabs:", error);
        return { count: 0 };
      }
      
      return { count: count || 0 };
    },
    enabled: !!creator?.id,
    staleTime: 30_000,
  });

  const activeCount = data?.count ?? 0;
  // Value-based trial: free users can approve unlimited collabs
  // The gate is at the publish step (handled in Workspace.tsx)
  const canApprove = true;

  return { 
    activeCount, 
    canApprove,
    isLoading,
    refetch,
  };
}
