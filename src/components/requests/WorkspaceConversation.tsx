import { useEffect, useRef, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Participant {
  email?: string | null;
  display_name: string;
}

interface WorkspaceConversationProps {
  requestId: string;
  /** Legacy fallback used only when a message row is missing sender_email. */
  currentUserIsCreator: boolean;
  refreshKey?: number;
  /** Known workspace participants for resolving sender display names. */
  participants?: Participant[];
}

interface Message {
  id: string;
  sender_type: string;
  sender_email: string;
  content: string;
  created_at: string | null;
}

function WorkspaceConversationInner({
  requestId,
  currentUserIsCreator,
  refreshKey = 0,
  participants = [],
}: WorkspaceConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["workspace-messages", requestId, user?.id, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collaboration_messages")
        .select("id, sender_type, sender_email, content, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!user && !!requestId && !authLoading,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-10 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-6">
        <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          No messages yet.
          <br />
          Start the conversation!
        </p>
      </div>
    );
  }

  const currentEmail = user?.email?.toLowerCase() || null;
  const participantMap = new Map<string, string>();
  for (const p of participants) {
    if (p.email) participantMap.set(p.email.toLowerCase(), p.display_name);
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[320px] pr-1 scrollbar-thin">
      {messages.map((msg) => {
        const senderEmail = msg.sender_email?.toLowerCase() || null;
        // Identity-first: match sender_email to the current user. Fall back
        // to the legacy sender_type flag only if the row has no email.
        const isMe = senderEmail
          ? senderEmail === currentEmail
          : (currentUserIsCreator && msg.sender_type === "creator") ||
            (!currentUserIsCreator && msg.sender_type === "requester");

        const senderName =
          (senderEmail && participantMap.get(senderEmail)) ||
          (msg.sender_type === "creator" ? "Host" : "Partner");

        const timeAgo = msg.created_at
          ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })
          : "";

        return (
          <div key={msg.id} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground font-medium px-1">
              {isMe ? "You" : senderName} · {timeAgo}
            </span>
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-xs leading-relaxed break-words",
                isMe
                  ? "bg-primary/10 text-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export const WorkspaceConversation = memo(WorkspaceConversationInner);


