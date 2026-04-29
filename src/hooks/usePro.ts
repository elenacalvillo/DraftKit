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

const defaultCapacity: HostCapacity = { limit: 3, used: 0, remaining: 3, referralBonus: 0 };

export function usePro() {
  const { user, creator, loading: authLoading, creatorLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["isPro", user?.id, creator?.id],
    queryFn: async (): Promise<ProStatus> => {
      if (!user?.id) {
        return { isPro: false, tier: 'free', trialEndsAt: null, isInTrial: false, hostCapacity: defaultCapacity, canHostMore: true };
      }

      // Read subscription_tier / trial_ends_at from the creator object already
      // loaded by useAuth — eliminates a redundant `creators?select=...` call.
      const subscriptionTier = (creator as any)?.subscription_tier || 'free';
      const trialEndsAt = (creator as any)?.trial_ends_at || null;
      const isInTrial = trialEndsAt && new Date(trialEndsAt) > new Date();

      // has_role still needs a server check — it's the source of truth for
      // founders / VIP grants. Cached for 5 min via staleTime below.
      const { data: roleData, error: roleError } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "pro",
      });
      if (roleError) console.error("Error checking pro role:", roleError);
      const hasRole = roleData === true;

      const isPaidOrFounder = hasRole || subscriptionTier === 'pro';
      const isPro = isPaidOrFounder || Boolean(isInTrial);

      // Fetch host capacity (cheap: single RPC, results cached 5 min)
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
    // Wait for both auth AND creator profile to be loaded before firing.
    // Otherwise we'd fire once with creator=null then refetch when it loads.
    enabled: !!user?.id && !authLoading && !creatorLoading,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isPro: data?.isPro ?? false,
    tier: data?.tier ?? 'free',
    trialEndsAt: data?.trialEndsAt ?? null,
    isInTrial: data?.isInTrial ?? false,
    hostCapacity: data?.hostCapacity ?? defaultCapacity,
    canHostMore: data?.canHostMore ?? true,
    isLoading,
  };
}
