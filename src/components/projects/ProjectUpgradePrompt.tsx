import { BookMarked, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Shown to Free or Pro tier users when they navigate to the
 * Projects area. Mirrors the existing UpgradePrompt component but
 * is scoped to the Project tier specifically.
 */
export function ProjectUpgradePrompt() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleUpgrade = () => {
    navigate(
      `/dashboard/subscription?returnTo=${encodeURIComponent(location.pathname)}&plan=project`,
    );
  };

  return (
    <Card className="max-w-xl mx-auto mt-12 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <BookMarked className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Book Projects are a Project tier feature</h2>
        <p className="text-muted-foreground mb-6">
          Organize an entire book in DraftKit: create chapters, invite
          your team with role-based access, broadcast updates to
          everyone at once, and embed images in your manuscript — all
          in one workspace.
        </p>
        <Button onClick={handleUpgrade} size="lg">
          <Crown className="w-4 h-4 mr-2" />
          Upgrade to Project tier
        </Button>
      </CardContent>
    </Card>
  );
}
