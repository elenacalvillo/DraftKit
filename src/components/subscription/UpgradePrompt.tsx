import { Crown, Sparkles, FileText, Users, Calendar, Palette, MessageSquare, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";

type FeatureType = 'export' | 'collabs' | 'mode' | 'matching' | 'style' | 'workspace' | 'editor';

interface UpgradePromptProps {
  feature: FeatureType;
  variant?: "inline" | "card";
  className?: string;
}

const FEATURE_COPY: Record<FeatureType, { 
  title: string; 
  description: string; 
  icon: typeof Crown;
}> = {
  export: {
    title: "Export to Google Docs & Word",
    description: "One-click export to your favorite writing tools",
    icon: FileText,
  },
  collabs: {
    title: "Unlimited Collaborations",
    description: "You've used your 3 free collaborations — upgrade to keep publishing",
    icon: Users,
  },
  mode: {
    title: "Custom Collaboration Playbook",
    description: "Toggle between Async and Discovery modes",
    icon: Calendar,
  },
  matching: {
    title: "Advanced SMART Matching",
    description: "Deep archive analysis for more complex matches",
    icon: Sparkles,
  },
  style: {
    title: "Custom Profile Themes",
    description: "Personalize your booking page with brand colors",
    icon: Palette,
  },
  workspace: {
    title: "Workspace Conversation History",
    description: "Keep your collaboration context in one place",
    icon: MessageSquare,
  },
  editor: {
    title: "Edit & Format Drafts",
    description: "Take control of the workspace with full editing tools",
    icon: PenLine,
  },
};

export function UpgradePrompt({ feature, variant = "inline", className }: UpgradePromptProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const { title, description, icon: Icon } = FEATURE_COPY[feature];

  // Fire once per mount per feature/path so we can measure shown vs. clicked.
  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    trackEvent("upgrade_prompt_shown", {
      surface: "upgrade_prompt",
      feature,
      variant,
      path: location.pathname,
    });
  }, [feature, variant, location.pathname, trackEvent]);

  const handleUpgrade = () => {
    trackEvent("upgrade_prompt_clicked", {
      surface: "upgrade_prompt",
      feature,
      variant,
      path: location.pathname,
    });
    navigate(`/dashboard/subscription?returnTo=${encodeURIComponent(location.pathname)}`);
  };

  if (variant === "inline") {
    return (
      <button
        onClick={handleUpgrade}
        className={cn(
          "flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer w-full text-left",
          className
        )}
      >
        <Crown className="w-4 h-4" />
        <span className="text-sm">Upgrade for {title}</span>
      </button>
    );
  }

  return (
    <div className={cn(
      "p-4 bg-muted/50 rounded-xl border border-dashed border-primary/30",
      className
    )}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h4 className="font-medium text-sm mb-1">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUpgrade}
        className="w-full border-primary/30 text-primary hover:bg-primary/10"
      >
        <Crown className="w-3.5 h-3.5 mr-2" />
        Upgrade to Pro
      </Button>
    </div>
  );
}
