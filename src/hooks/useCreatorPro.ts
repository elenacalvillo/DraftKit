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
        .select("user_id, subscription_tier, trial_ends_at")
        .eq("id", creatorId)
        .maybeSingle();

      if (error || !data) return false;

      const { user_id, subscription_tier, trial_ends_at } = data as {
        user_id: string;
        subscription_tier: string | null;
        trial_ends_at: string | null;
      };

      // Check active trial
      const isInTrial = trial_ends_at ? new Date(trial_ends_at) > new Date() : false;

      // Check subscription tier
      if (subscription_tier === "pro" || isInTrial) return true;

      // Check user_roles for manual pro (e.g. early adopters, lifetime deals)
      const { data: hasRole } = await supabase.rpc("has_role", {
        _user_id: user_id,
        _role: "pro",
      });

      return Boolean(hasRole);
    },
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 min cache — tier changes are infrequent
  });

  return {
    isPro: data ?? false,
    isLoading,
  };
}
