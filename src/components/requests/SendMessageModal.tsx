import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Mail } from "lucide-react";
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

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  creatorEmail: string;
}

export function SendMessageModal({
  open,
  onOpenChange,
  requestId,
  requesterName,
  requesterEmail,
  creatorEmail,
}: SendMessageModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);

    try {
      // Save message to database
      const { error } = await supabase.from("collaboration_messages").insert({
        request_id: requestId,
        sender_type: "creator",
        sender_email: creatorEmail,
        content: message.trim(),
      });

      if (error) throw error;

      toast.success(`Message sent to ${requesterName}!`, {
        description: "They'll receive it at " + requesterEmail,
      });
      setMessage("");
      onOpenChange(false);
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
            <Mail className="w-5 h-5 text-primary" />
            Message {requesterName}
          </DialogTitle>
          <DialogDescription>
            Send a quick message to your collaborator at {requesterEmail}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Textarea
            placeholder="Hey! I'm excited about this collaboration. I was thinking we could..."
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
