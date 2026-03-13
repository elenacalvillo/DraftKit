import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const FREE_COLLAB_LIMIT = 3;

interface ProStatus {
  isPro: boolean;
  tier: 'free' | 'pro';
  trialEndsAt: string | null;
  isInTrial: boolean;
  publishedCount: number;
  freeCollabsRemaining: number;
  isInFreeTier: boolean;
}

export function usePro() {
  const { user, creator } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["isPro", user?.id, creator?.id],
    queryFn: async (): Promise<ProStatus> => {
      if (!user?.id) return { isPro: false, tier: 'free', trialEndsAt: null, isInTrial: false, publishedCount: 0, freeCollabsRemaining: FREE_COLLAB_LIMIT, isInFreeTier: true };
      
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
      
      // Legacy: honor existing time-based trials
      const isInTrial = trialEndsAt && new Date(trialEndsAt) > new Date();
      
      // Count published collabs for this creator
      let publishedCount = 0;
      if (creator?.id) {
        const { count, error: countError } = await supabase
          .from('collab_requests')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', creator.id)
          .eq('status', 'published');
        
        if (countError) {
          console.error("Error counting published collabs:", countError);
        } else {
          publishedCount = count || 0;
        }
      }
      
      const freeCollabsRemaining = Math.max(0, FREE_COLLAB_LIMIT - publishedCount);
      
      // User is Pro if: has pro role OR paid subscription OR legacy trial OR still within free collab allowance
      const isFounderOrPaid = hasRole || subscriptionTier === 'pro';
      const isInFreeTier = !isFounderOrPaid && !isInTrial && publishedCount < FREE_COLLAB_LIMIT;
      const isPro = isFounderOrPaid || Boolean(isInTrial) || isInFreeTier;
      
      return {
        isPro,
        tier: subscriptionTier as 'free' | 'pro',
        trialEndsAt,
        isInTrial: Boolean(isInTrial),
        publishedCount,
        freeCollabsRemaining,
        isInFreeTier,
      };
    },
    enabled: !!user?.id,
  });

  return { 
    isPro: data?.isPro ?? false, 
    tier: data?.tier ?? 'free',
    trialEndsAt: data?.trialEndsAt ?? null,
    isInTrial: data?.isInTrial ?? false,
    publishedCount: data?.publishedCount ?? 0,
    freeCollabsRemaining: data?.freeCollabsRemaining ?? FREE_COLLAB_LIMIT,
    isInFreeTier: data?.isInFreeTier ?? true,
    isLoading 
  };
}
