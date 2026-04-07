import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InviteCollaboratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  isPro: boolean;
  credits: number;
  onInvited: () => void;
}

export function InviteCollaboratorModal({
  open,
  onOpenChange,
  requestId,
  isPro,
  credits,
  onInvited,
}: InviteCollaboratorModalProps) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Credit check (Pro users skip)
    if (!isPro && credits < 1) {
      toast.error("You need at least 1 credit to invite a collaborator", {
        description: "Top up credits on the Membership page.",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert collaborator row (RLS ensures only the owner can do this)
      const { error: insertError } = await supabase
        .from("workspace_collaborators")
        .insert({
          request_id: requestId,
          email: trimmed,
          invited_by: user.id,
        } as any);

      if (insertError) {
        if (insertError.message?.includes("duplicate key") || insertError.code === "23505") {
          toast.error("This person has already been invited");
        } else {
          throw insertError;
        }
        return;
      }

      // Deduct 1 credit if not Pro
      if (!isPro) {
        await supabase
          .from("creators")
          .update({ credits: credits - 1 })
          .eq("user_id", user.id);
      }

      // Fire invite email (fire-and-forget)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        supabase.functions.invoke("send-collab-email", {
          body: { type: "workspace_invite", requestId, inviteeEmail: trimmed },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }

      toast.success(`Invitation sent to ${trimmed}`);
      setEmail("");
      onInvited();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to invite collaborator:", err);
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add to Writer's Room
          </DialogTitle>
          <DialogDescription>
            Invite another writer to collaborate on this piece.
            {!isPro && credits > 0 && (
              <span className="block mt-1 text-xs text-muted-foreground">
                This will use 1 credit. You have {credits} remaining.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Input
            type="email"
            placeholder="writer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={handleInvite}
              disabled={isSending || !email.trim()}
            >
              {isSending ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
