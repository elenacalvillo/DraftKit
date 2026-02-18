import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreatorProStatus {
  isPro: boolean;
  isLoading: boolean;
}

/**
 * Checks whether the HOST creator (identified by their creators.id) has Pro access.
 * Used by the workspace so that the guest inherits the host's tier — never their own.
 */
export function useCreatorPro(creatorId: string | undefined): CreatorProStatus {
  const { data, isLoading } = useQuery({
    queryKey: ["creatorPro", creatorId],
    queryFn: async (): Promise<boolean> => {
      if (!creatorId) return false;

      // Fetch subscription_tier, trial_ends_at, and user_id from creators table.
      // RLS allows SELECT where username IS NOT NULL (public policy).
      const { data, error } = await supabase
        .from("creators")
        .select("subscription_tier, trial_ends_at")
        .eq("id", creatorId)
        .maybeSingle();

      if (error || !data) return false;

      const { subscription_tier, trial_ends_at } = data as {
        subscription_tier: string | null;
        trial_ends_at: string | null;
      };

      const isInTrial = trial_ends_at ? new Date(trial_ends_at) > new Date() : false;

      return subscription_tier === "pro" || isInTrial;
    },
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 min cache — tier changes are infrequent
  });

  return {
    isPro: data ?? false,
    isLoading,
  };
}
