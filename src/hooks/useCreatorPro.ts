import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreatorProStatus {
  isPro: boolean;
  isLoading: boolean;
}

/**
 * Checks whether the HOST creator has Pro access.
 * 
 * IMPORTANT: This hook is now ONLY used to determine if the host is a paying/founder member
 * for features like AI draft generation. It does NOT gate workspace access.
 * Workspace access is always open for approved/published collabs regardless of tier.
 */
export function useCreatorPro(creatorId: string | undefined): CreatorProStatus {
  const { data, isLoading } = useQuery({
    queryKey: ["creatorPro", creatorId],
    queryFn: async (): Promise<boolean> => {
      if (!creatorId) return false;

      const { data, error } = await supabase
        .from("creators")
        .select("subscription_tier, trial_ends_at, user_id")
        .eq("id", creatorId)
        .maybeSingle();

      if (error || !data) return false;

      const { subscription_tier, trial_ends_at, user_id } = data as {
        subscription_tier: string | null;
        trial_ends_at: string | null;
        user_id: string;
      };

      const isInTrial = trial_ends_at ? new Date(trial_ends_at) > new Date() : false;
      const isSubPro = subscription_tier === "pro";

      if (isSubPro || isInTrial) return true;

      // Also check user_roles table for 'pro' role (early adopters / VIP grants)
      const { data: roleData } = await supabase.rpc("has_role", {
        _user_id: user_id,
        _role: "pro",
      });

      return roleData === true;
    },
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isPro: data ?? false,
    isLoading,
  };
}
