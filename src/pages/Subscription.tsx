import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Crown, Sparkles, Users, MessageSquare, PenLine, Palette, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePro } from "@/hooks/usePro";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const { isPro, isInTrial, trialEndsAt, tier } = usePro();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.error === "no_stripe_customer") {
        toast({ title: "No subscription found", description: "Subscribe to Pro first to manage your billing.", variant: "destructive" });
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Could not open portal", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Crown className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">DraftKit Pro</h1>
          </div>
          <p className="text-muted-foreground">
            Professional tools for serious newsletter collaborators.
          </p>
        </div>

        {/* Trial / Active Pro banner */}
        {isPro && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {isInTrial
                    ? `Founding Member Trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left`
                    : "You're on Pro"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isInTrial
                    ? "Subscribe now to keep your Pro features."
                    : "All features unlocked."}
                </p>
              </div>
              {!isInTrial && tier === 'pro' && (
                <Button variant="outline" size="sm" onClick={handleManage} disabled={loading}>
                  Manage
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pricing card */}
        <Card className="overflow-hidden">
          {/* Billing toggle */}
          <div className="flex justify-center gap-1 p-1.5 bg-muted rounded-xl mx-auto w-fit">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                billing === "monthly"
                  ? "bg-primary text-primary-foreground shadow-md"
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
                  ? "bg-primary text-primary-foreground shadow-md"
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
            {/* Price display */}
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

            {/* Features */}
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

            {/* Early access badge */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-6">
              <Rocket className="w-4 h-4 text-accent-foreground" />
              <span className="text-xs text-muted-foreground">
                Includes future access to <span className="font-medium text-foreground">Creator Discovery</span> tools.
              </span>
            </div>

            {/* CTA */}
            <Button
              className="w-full gradient-primary text-primary-foreground"
              size="lg"
              onClick={handleCheckout}
              disabled={loading || (isPro && !isInTrial)}
            >
              <Crown className="w-4 h-4 mr-2" />
              {isPro && !isInTrial ? "You're on Pro" : "Start Pro"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
