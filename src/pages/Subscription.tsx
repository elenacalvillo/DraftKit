import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Crown, Sparkles, Users, MessageSquare, PenLine, Palette, Rocket, Check, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePro } from "@/hooks/usePro";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const MONTHLY_PRICE_ID = "price_1Szs8CAgAh00fVW11BjTnSrF";
const YEARLY_PRICE_ID = "price_1Szs8KAgAh00fVW1sKwidi8l";

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
  const { isPro, isInTrial, trialEndsAt, hostCapacity, canHostMore } = usePro();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Detect founding member status
  const { data: creatorBilling } = useQuery({
    queryKey: ["creator-billing", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("creators")
        .select("stripe_customer_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isFounder = isPro && !isInTrial && !creatorBilling?.stripe_customer_id;
  const isPaidPro = isPro && !isInTrial && !!creatorBilling?.stripe_customer_id;

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
                  ? "You helped build DraftKit from day one. All Pro features are yours, forever."
                  : "All features unlocked. Thank you for being part of the engine."}
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

          {/* Creator Discovery teaser */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-6">
            <Rocket className="w-4 h-4 text-accent-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Creator Discovery</span> tools are coming soon — you'll get them automatically.
            </span>
          </div>

          {/* Manage Billing — only for paying subscribers */}
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

  // View B: Free / Trial / Free-tier users
  const progressPercent = Math.round((publishedCount / 3) * 100);

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

        {/* Collab progress banner (replaces trial days banner) */}
        {isInFreeTier && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">
                  {publishedCount} of 3 free collaborations used
                </p>
                <Badge variant="secondary" className="text-xs">
                  {freeCollabsRemaining} left
                </Badge>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {publishedCount >= 2 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Upgrade to unlock unlimited collaborations.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Legacy trial banner */}
        {isInTrial && !isInFreeTier && (() => {
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
                Save $30
              </Badge>
            </button>
          </div>

          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">
                  {billing === "monthly" ? "$14.99" : "$12.42"}
                </span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              {billing === "yearly" && (
                <p className="text-xs text-muted-foreground mt-1">
                  $149 billed annually — 2 months free
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
              Unlock Unlimited Collabs
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
