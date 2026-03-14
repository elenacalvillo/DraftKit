import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface HostCapacity {
  limit: number;
  used: number;
  remaining: number;
  referralBonus: number;
}

interface ProStatus {
  /** True only for paid subscribers, founders, or legacy trial users */
  isPro: boolean;
  tier: 'free' | 'pro';
  trialEndsAt: string | null;
  isInTrial: boolean;
  /** Host capacity: base 3 + referral bonuses - used */
  hostCapacity: HostCapacity;
  /** Can this creator accept more incoming collabs on their booking page? */
  canHostMore: boolean;
}

export function usePro() {
  const { user, creator } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["isPro", user?.id, creator?.id],
    queryFn: async (): Promise<ProStatus> => {
      const defaultCapacity: HostCapacity = { limit: 3, used: 0, remaining: 3, referralBonus: 0 };
      if (!user?.id) return { isPro: false, tier: 'free', trialEndsAt: null, isInTrial: false, hostCapacity: defaultCapacity, canHostMore: true };
      
      // Check user_roles for manual pro (early adopters, lifetime deals)
      const [roleResult, creatorResult] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "pro" }),
        supabase.from('creators').select('subscription_tier, trial_ends_at').eq('user_id', user.id).maybeSingle(),
      ]);
      
      if (roleResult.error) console.error("Error checking pro role:", roleResult.error);
      if (creatorResult.error) console.error("Error checking subscription:", creatorResult.error);
      
      const hasRole = roleResult.data === true;
      const subscriptionTier = (creatorResult.data as any)?.subscription_tier || 'free';
      const trialEndsAt = (creatorResult.data as any)?.trial_ends_at || null;
      const isInTrial = trialEndsAt && new Date(trialEndsAt) > new Date();
      
      const isPaidOrFounder = hasRole || subscriptionTier === 'pro';
      const isPro = isPaidOrFounder || Boolean(isInTrial);

      // Fetch host capacity
      let hostCapacity = defaultCapacity;
      if (creator?.id) {
        const { data: capData, error: capError } = await supabase.rpc("get_host_capacity", { _creator_id: creator.id });
        if (!capError && capData) {
          const cap = capData as any;
          const limit = (cap.base_limit || 3) + (cap.referral_bonus || 0);
          const used = cap.used || 0;
          hostCapacity = { limit, used, remaining: Math.max(0, limit - used), referralBonus: cap.referral_bonus || 0 };
        }
      }

      const canHostMore = isPro || hostCapacity.remaining > 0;
      
      return {
        isPro,
        tier: subscriptionTier as 'free' | 'pro',
        trialEndsAt,
        isInTrial: Boolean(isInTrial),
        hostCapacity,
        canHostMore,
      };
    },
    enabled: !!user?.id,
  });

  const defaultCapacity: HostCapacity = { limit: 3, used: 0, remaining: 3, referralBonus: 0 };

  return { 
    isPro: data?.isPro ?? false, 
    tier: data?.tier ?? 'free',
    trialEndsAt: data?.trialEndsAt ?? null,
    isInTrial: data?.isInTrial ?? false,
    hostCapacity: data?.hostCapacity ?? defaultCapacity,
    canHostMore: data?.canHostMore ?? true,
    isLoading 
  };
}
