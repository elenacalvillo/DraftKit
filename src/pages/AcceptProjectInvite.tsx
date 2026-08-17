import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";

type State = "working" | "accepted" | "error";

/**
 * Landing page for project invitation emails. Accepting is what flips a
 * member from "Pending invite" to "Joined" — having an account never does.
 */
export default function AcceptProjectInvite() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<State>("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const accept = async () => {
      if (!projectId) return;
      const { error } = await supabase.rpc("accept_project_invite", {
        _project_id: projectId,
      });
      if (cancelled) return;
      if (error) {
        setState("error");
        setMessage(
          error.message.includes("No invitation found")
            ? `This invitation was not sent to ${user?.email ?? "this account"}. Sign in with the address the invitation was sent to, or ask the project owner to invite this address.`
            : error.message,
        );
        return;
      }
      setState("accepted");
      setTimeout(() => {
        if (!cancelled) navigate(`/dashboard/projects/${projectId}`, { replace: true });
      }, 1200);
    };
    accept();
    return () => {
      cancelled = true;
    };
  }, [projectId, navigate, user?.email]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <DraftKitLogo size={48} />
          </div>

          {state === "working" && (
            <>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Accepting your invitation…
              </p>
            </>
          )}
          {state === "accepted" && (
            <>
              <CheckCircle2 className="w-8 h-8 mx-auto text-primary" />
              <h1 className="text-lg font-semibold">You're in</h1>
              <p className="text-sm text-muted-foreground">
                Opening the project…
              </p>
            </>
          )}
          {state === "error" && (
            <>
              <MailWarning className="w-8 h-8 mx-auto text-destructive" />
              <h1 className="text-lg font-semibold">
                We couldn't accept this invitation
              </h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => navigate("/dashboard")}>
                  Go to dashboard
                </Button>
                <Button variant="outline" asChild>
                  <a href="mailto:hello@draftkit.app?subject=Project%20invitation%20problem">
                    Email support
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
