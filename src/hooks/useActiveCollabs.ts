import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePro } from "./usePro";

const FREE_TIER_LIMIT = 1;

export function useActiveCollabs() {
  const { creator } = useAuth();
  const { isPro } = usePro();
  
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
  });

  const activeCount = data?.count ?? 0;
  const limit = isPro ? Infinity : FREE_TIER_LIMIT;
  const canApprove = isPro || activeCount < FREE_TIER_LIMIT;
  const remainingSlots = isPro ? Infinity : Math.max(0, FREE_TIER_LIMIT - activeCount);

  return { 
    activeCount, 
    limit,
    canApprove,
    remainingSlots,
    isLoading,
    refetch,
  };
}
