import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface ProStatus {
  isPro: boolean;
  tier: 'free' | 'pro';
  trialEndsAt: string | null;
  isInTrial: boolean;
}

export function usePro() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["isPro", user?.id],
    queryFn: async (): Promise<ProStatus> => {
      if (!user?.id) return { isPro: false, tier: 'free', trialEndsAt: null, isInTrial: false };
      
      // Check user_roles for manual pro (early adopters, lifetime deals)
      const { data: hasRole, error: roleError } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "pro",
      });
      
      if (roleError) {
        console.error("Error checking pro role:", roleError);
      }
      
      // Check creator subscription tier
      const { data: creatorData, error: creatorError } = await supabase
        .from('creators')
        .select('subscription_tier, trial_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (creatorError) {
        console.error("Error checking subscription:", creatorError);
      }
      
      const subscriptionTier = (creatorData as any)?.subscription_tier || 'free';
      const trialEndsAt = (creatorData as any)?.trial_ends_at || null;
      
      // Check if in active trial
      const isInTrial = trialEndsAt && new Date(trialEndsAt) > new Date();
      
      // User is Pro if: has pro role OR has pro subscription tier OR is in active trial
      const isPro = hasRole || subscriptionTier === 'pro' || isInTrial;
      
      return {
        isPro,
        tier: subscriptionTier as 'free' | 'pro',
        trialEndsAt,
        isInTrial: Boolean(isInTrial),
      };
    },
    enabled: !!user?.id,
  });

  return { 
    isPro: data?.isPro ?? false, 
    tier: data?.tier ?? 'free',
    trialEndsAt: data?.trialEndsAt ?? null,
    isInTrial: data?.isInTrial ?? false,
    isLoading 
  };
}
