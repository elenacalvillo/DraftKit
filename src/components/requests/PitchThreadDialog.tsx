import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  sender_type: string;
  sender_email: string;
  content: string;
  created_at: string;
};

interface PitchThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  /** Original pitch text shown at the top of the thread. */
  pitch?: string | null;
  /** True when the signed-in user hosts this collab. */
  isHost: boolean;
  senderEmail: string | null | undefined;
  counterpartName: string;
}

/**
 * Two-way thread for collabs that have not been approved yet. Lets the host
 * read the full pitch and talk to the guest before deciding, and lets the
 * guest reply without needing workspace access.
 */
export function PitchThreadDialog({
  open,
  onOpenChange,
  requestId,
  pitch,
  isHost,
  senderEmail,
  counterpartName,
}: PitchThreadDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("collaboration_messages")
      .select("id, sender_type, sender_email, content, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[PitchThreadDialog] load failed", error);
          toast.error("Could not load this conversation");
        }
        setMessages((data ?? []) as Message[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requestId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) {
      toast.error("Write a message first");
      return;
    }
    if (!senderEmail) {
      toast.error("We couldn't identify your email. Refresh and try again.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("collaboration_messages")
        .insert({
          request_id: requestId,
          sender_type: isHost ? "creator" : "requester",
          sender_email: senderEmail,
          content,
        })
        .select("id, sender_type, sender_email, content, created_at")
        .single();
      if (error) throw error;

      setMessages((prev) => [...prev, data as Message]);
      setDraft("");

      // Direction matters: hosts notify the guest, guests notify the host.
      supabase.functions
        .invoke("send-collab-email", {
          body: {
            type: isHost ? "new_message" : "new_message_from_guest",
            requestId,
            messageContent: content,
            senderEmail,
          },
        })
        .catch((err) => console.error("[PitchThreadDialog] email failed", err));

      toast.success(`Message sent to ${counterpartName}`);
    } catch (err) {
      console.error("[PitchThreadDialog] send failed", err);
      toast.error(
        err instanceof Error
          ? `Could not send: ${err.message}`
          : "Could not send your message",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {counterpartName}
          </DialogTitle>
          <DialogDescription>
            Talk it through before this collab is approved or declined.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[45vh] pr-3">
          <div className="space-y-3">
            {pitch && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {isHost ? "Their pitch" : "Your pitch"}
                </p>
                <p className="whitespace-pre-line text-sm">{pitch}</p>
              </div>
            )}
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversation…
              </div>
            ) : messages.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No replies yet.
              </p>
            ) : (
              messages.map((m) => {
                const mine = isHost
                  ? m.sender_type === "creator"
                  : m.sender_type !== "creator";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      mine ? "bg-primary/10 border-primary/20" : "bg-card",
                    )}
                  >
                    <p className="mb-1 text-xs text-muted-foreground">
                      {mine ? "You" : counterpartName}
                    </p>
                    <p className="whitespace-pre-line">{m.content}</p>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Reply to ${counterpartName}…`}
            rows={3}
            aria-label="Reply message"
          />
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send message
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
