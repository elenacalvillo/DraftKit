import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Crown, Sparkles, Users, MessageSquare, PenLine, Palette, Rocket, Check, Heart, Coins, UserPlus, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePro } from "@/hooks/usePro";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const MONTHLY_PRICE_ID = "price_1Szs8CAgAh00fVW11BjTnSrF";
const YEARLY_PRICE_ID = "price_1TJRLwAgAh00fVW16vp9a32v";

const features = [
  { icon: Users, label: "Unlimited Collaborative Workspaces" },
  { icon: PenLine, label: "Floating Action Pill (The Editor)" },
  { icon: MessageSquare, label: "Full Conversation History" },
  { icon: Sparkles, label: "SMART-Powered First Drafts" },
  { icon: Palette, label: "Custom Profile Themes" },
];

export default function Subscription() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const { isPro, isProject, tier, isInTrial, trialEndsAt, hostCapacity, canHostMore } = usePro();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: creatorBilling } = useQuery({
    queryKey: ["creator-billing", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("creators")
        .select("stripe_customer_id, credits")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isFounder = isPro && !isInTrial && !creatorBilling?.stripe_customer_id;
  const isPaidPro = isPro && !isInTrial && !!creatorBilling?.stripe_customer_id;
  const creditBalance = creatorBilling?.credits ?? 3;

  // Handle success params
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Welcome to the Engine 🎉",
        description: "Your workspace is now unlocked. All Pro features are active.",
      });
      searchParams.delete("success");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Handle credit fulfillment
  useEffect(() => {
    const sessionId = searchParams.get("credits_session");
    const creditsAmount = searchParams.get("credits_amount");
    if (!sessionId || !creditsAmount || !user) return;

    const fulfill = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fulfill-credits", {
          body: { sessionId, credits: parseInt(creditsAmount, 10) },
        });
        if (error) throw error;
        toast({
          title: `${creditsAmount} credits added! 🎉`,
          description: `Your new balance is ${data.credits} credits.`,
        });
        queryClient.invalidateQueries({ queryKey: ["creator-billing", user.id] });
      } catch (err: any) {
        toast({ title: "Credit fulfillment failed", description: err.message, variant: "destructive" });
      } finally {
        searchParams.delete("credits_session");
        searchParams.delete("credits_amount");
        setSearchParams(searchParams, { replace: true });
      }
    };
    fulfill();
  }, [user]);

  const handleCheckout = async () => {
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const priceId = billing === "monthly" ? MONTHLY_PRICE_ID : YEARLY_PRICE_ID;
      const returnTo = searchParams.get("returnTo") || undefined;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, returnTo },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectCheckout = async () => {
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const returnTo = searchParams.get("returnTo") || undefined;
      // Project tier price ID is configured server-side via the
      // PROJECT_TIER_PRICE_ID env var — see create-checkout.
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: "project", returnTo },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast({ title: "Checkout failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Could not open portal", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = async (packId: string) => {
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-credits", {
        body: { packId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Credit balance display component
  const CreditSection = ({ showTopUp }: { showTopUp: boolean }) => (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Writer's Credits</h3>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold">{creditBalance}</span>
          <span className="text-sm text-muted-foreground">credits in your pocket</span>
        </div>
        {isPro && !isInTrial && (
          <p className="text-xs text-muted-foreground mt-1">
            Credits aren't consumed on Pro — they're saved for later.
          </p>
        )}
        {showTopUp && (
          <>
            <p className="text-sm text-muted-foreground mt-4 mb-3">Need a quick boost?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePurchaseCredits("10")}
                disabled={loading}
                className="flex flex-col items-center p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <span className="text-lg font-bold">10</span>
                <span className="text-xs text-muted-foreground">credits</span>
                <span className="text-sm font-semibold mt-1">$10</span>
              </button>
              <button
                onClick={() => handlePurchaseCredits("30")}
                disabled={loading}
                className="flex flex-col items-center p-4 rounded-lg border border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition-all relative"
              >
                <Badge variant="secondary" className="absolute -top-2 text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">
                  Best value
                </Badge>
                <span className="text-lg font-bold">30</span>
                <span className="text-xs text-muted-foreground">credits</span>
                <span className="text-sm font-semibold mt-1">$25</span>
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  // View A: Founding Members & Paid Pro
  if (isPro && !isInTrial) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Crown className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Membership</h1>
            </div>
          </div>

          {/* Status card */}
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center gap-2 mb-3">
                {isFounder ? (
                  <Heart className="w-5 h-5 text-primary fill-primary/20" />
                ) : (
                  <Crown className="w-5 h-5 text-primary" />
                )}
                <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 text-sm px-3 py-1">
                  {isFounder ? "Founding Member" : "Pro Member"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                {isFounder
                  ? "You helped build DraftKit from day one. All Pro features are yours, forever. Book Projects are a separate add-on tier."
                  : "All Pro features unlocked. Thank you for being part of the engine."}
              </p>
            </CardContent>
          </Card>

          {/* Features Unlocked */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Features Unlocked
              </h3>
              <ul className="space-y-3">
                {features.map(({ label }) => (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Credit balance (no top-up for Pro) */}
          <CreditSection showTopUp={false} />

          {/* Creator Discovery teaser */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-6">
            <Rocket className="w-4 h-4 text-accent-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Creator Discovery</span> tools are coming soon — you'll get them automatically.
            </span>
          </div>

          {isPaidPro && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageBilling}
              disabled={loading}
            >
              Manage Billing
            </Button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // View B: Free / Trial users
  const slotsOpen = hostCapacity.remaining;

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Crown className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Membership</h1>
          </div>
          <p className="text-muted-foreground">
            Free to start. Upgrade when you're ready.
          </p>
        </div>

        {/* Collaboration slots banner */}
        {!isPro && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <p className="font-semibold text-base">
                {slotsOpen > 0
                  ? `You have ${slotsOpen} collaboration slot${slotsOpen !== 1 ? "s" : ""} open`
                  : "All collaboration slots are filled"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {slotsOpen > 0
                  ? "Ready for your next co-writer? Start a new collaboration anytime."
                  : "Invite a friend or go unlimited to keep collaborating."}
              </p>
              {hostCapacity.referralBonus > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  You've earned {hostCapacity.referralBonus} bonus slot{hostCapacity.referralBonus !== 1 ? "s" : ""} by inviting friends.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Legacy trial banner */}
        {isInTrial && (() => {
          const trialDaysLeft = trialEndsAt
            ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 0;
          return (
            <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="font-medium text-sm">
                  You're exploring Pro — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Subscribe to keep all your Pro features.
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Invite & Earn card */}
        <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base">Bring a writer, get a credit</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Invite a co-writer to DraftKit. When they join, you both get +1 collaboration credit.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-primary/30 hover:bg-primary/5"
                  onClick={() => {
                    // Navigate to dashboard where they can invite from a workspace
                    window.location.href = "/dashboard";
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Invite a Collaborator
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project tier upgrade card */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base">
                  Writing a book? Try the Project tier
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Includes everything in Pro, plus Book Projects: chapters,
                  team roles, broadcasts, and 1GB of image storage.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-primary/30 hover:bg-primary/5"
              onClick={handleProjectCheckout}
              disabled={loading}
            >
              <Crown className="w-3.5 h-3.5 mr-1.5" />
              Upgrade to Project tier
            </Button>
          </CardContent>
        </Card>

        {/* Pricing card */}
        <Card className="overflow-hidden">
          <div className="flex justify-center gap-1 p-1.5 bg-muted rounded-xl mx-auto w-fit mt-4">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                billing === "monthly"
                  ? "bg-background text-foreground shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                billing === "yearly"
                  ? "bg-background text-foreground shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">
                Save $29.98
              </Badge>
            </button>
          </div>

          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">
                  {billing === "monthly" ? "$14.99" : "$12.49"}
                </span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              {billing === "yearly" && (
                <p className="text-xs text-muted-foreground mt-1">
                  $149.90 billed annually — 2 months free
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-6">
              {features.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  {label}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-6">
              <Rocket className="w-4 h-4 text-accent-foreground" />
              <span className="text-xs text-muted-foreground">
                Includes future access to <span className="font-medium text-foreground">Creator Discovery</span> tools.
              </span>
            </div>

            <Button
              className="w-full gradient-primary text-primary-foreground"
              size="lg"
              onClick={handleCheckout}
              disabled={loading}
            >
              <Crown className="w-4 h-4 mr-2" />
              Go Unlimited
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              By continuing, you agree to our{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Terms of Service</a>
              {" "}and{" "}
              <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Refund Policy</a>.
            </p>
          </CardContent>
        </Card>

        {/* Credit top-up section */}
        <div className="mt-6">
          <CreditSection showTopUp={true} />
        </div>
      </div>
    </DashboardLayout>
  );
}
