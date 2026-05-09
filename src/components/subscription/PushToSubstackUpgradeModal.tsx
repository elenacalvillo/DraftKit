import { useEffect, useRef } from "react";
import { Crown, Send } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/hooks/useAnalytics";

/**
 * Inline upgrade prompt shown to free users who click the "Push to Substack"
 * button in the workspace toolbar. Modeled on the existing UpgradePrompt
 * card variant so the visual language matches other gates, but rendered as
 * a Dialog so the user does NOT lose their workspace context — that
 * constraint is explicit in DRAFT-003.
 *
 * The copy is intentionally feature-specific ("Push to Substack in one
 * click — Pro feature") rather than the generic "Upgrade to Pro for more
 * features", because this gate fires at the end of the drafting flow when
 * the user has the highest intent and the most context about *what* they
 * are unlocking.
 */
interface PushToSubstackUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PushToSubstackUpgradeModal({
  open,
  onOpenChange,
}: PushToSubstackUpgradeModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useAnalytics();

  // Mirror UpgradePrompt: fire `upgrade_prompt_shown` exactly once per open.
  // We tie the ref to the open state so re-opening fires it again — each
  // open is a distinct funnel impression we want to measure.
  const lastOpenRef = useRef(false);
  useEffect(() => {
    if (open && !lastOpenRef.current) {
      trackEvent("upgrade_prompt_shown", {
        surface: "push_to_substack_modal",
        feature: "push_to_substack",
        path: location.pathname,
      });
    }
    lastOpenRef.current = open;
  }, [open, location.pathname, trackEvent]);

  const handleUpgrade = () => {
    trackEvent("upgrade_prompt_clicked", {
      surface: "push_to_substack_modal",
      feature: "push_to_substack",
      path: location.pathname,
    });
    // Use the same returnTo round-trip as UpgradePrompt so the user lands
    // back in the workspace after upgrading.
    navigate(`/dashboard/subscription?returnTo=${encodeURIComponent(location.pathname)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Send className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-lg">
            Push to Substack in one click — Pro feature
          </DialogTitle>
          <DialogDescription>
            Upgrade to unlock. Send your finished draft straight to a new
            Substack post — no more copy-paste handoff.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            // Dismiss returns workspace to normal state, no action taken.
          >
            Not now
          </Button>
          <Button variant="gradient" onClick={handleUpgrade}>
            <Crown className="w-4 h-4 mr-2" />
            Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
