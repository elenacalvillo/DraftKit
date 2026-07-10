import { useState } from "react";
import { motion } from "framer-motion";
import { Send, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";

interface GuestMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  creatorName: string;
  /**
   * Email of the *sender* (the currently signed-in non-creator user).
   * For original requesters this is their requester_email; for invited
   * collaborators this is their auth user email. Required because the
   * `collaboration_messages.sender_email` column is NOT NULL — passing a
   * null here is what was breaking the first message in the conversation.
   */
  senderEmail: string | null | undefined;
  onMessageSent?: () => void;
}

export function GuestMessageModal({
  open,
  onOpenChange,
  requestId,
  creatorName,
  senderEmail,
  onMessageSent,
}: GuestMessageModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { trackEvent } = useAnalytics();

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!senderEmail) {
      console.error("GuestMessageModal: missing senderEmail — cannot insert message");
      toast.error("We couldn't identify your email. Please refresh and try again.");
      return;
    }

    setIsSending(true);

    try {
      // Save message to database
      const { error } = await supabase.from("collaboration_messages").insert({
        request_id: requestId,
        sender_type: "requester",
        sender_email: senderEmail,
        content: message.trim(),
      });

      if (error) throw error;

      trackEvent("workspace_message_sent", { request_id: requestId, sender_type: "requester" });

      // Send email notification to the creator
      supabase.functions.invoke('send-collab-email', {
        body: { 
          type: 'new_message_from_guest', 
          requestId,
          messageContent: message.trim(),
          senderEmail,
        }
      }).catch(err => console.error('Failed to send message email:', err));

      toast.success(`Message sent to ${creatorName}!`);
      setMessage("");
      onOpenChange(false);
      onMessageSent?.();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Message {creatorName}
          </DialogTitle>
          <DialogDescription>
            Send a message to your collaboration partner
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Textarea
            placeholder="Hi! I wanted to follow up on our collaboration..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none"
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gradient"
              className="flex-1"
              onClick={handleSend}
              disabled={isSending || !message.trim()}
            >
              {isSending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
