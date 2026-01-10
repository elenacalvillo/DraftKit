import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, Mail, Link as LinkIcon, Sparkles, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollabRequest, CollabDraft } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CollabDraftModal } from "./CollabDraftModal";
import { SendMessageModal } from "./SendMessageModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";

const extractSubstackName = (url: string | null | undefined): string => {
  if (!url) return "Unknown Substack";
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.endsWith('.substack.com')) {
      return urlObj.hostname.replace('.substack.com', '');
    }
    return urlObj.hostname;
  } catch {
    return url;
  }
};

interface RequestCardProps {
  request: CollabRequest;
  creatorEmail?: string;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onDraftGenerated?: (id: string, draft: CollabDraft) => void;
}

export function RequestCard({ request, creatorEmail, onApprove, onDecline, onDraftGenerated }: RequestCardProps) {
  const { trackEvent } = useAnalytics();
  const [imageError, setImageError] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [localDraft, setLocalDraft] = useState<CollabDraft | null>(
    request.aiDraft as CollabDraft | null
  );
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusColors = {
    pending: "bg-accent/10 text-accent border-accent/20",
    approved: "bg-success/10 text-success border-success/20",
    declined: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const showImage = request.requesterProfileImageUrl && !imageError;

  const generateDraft = async () => {
    setIsGeneratingDraft(true);
    setShowDraftModal(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-collab-draft", {
        body: { requestId: request.id },
      });

      if (error) throw error;

      if (data?.draft) {
        setLocalDraft(data.draft);
        onDraftGenerated?.(request.id, data.draft);
        toast.success("Collaboration draft generated!");
        
        // Track draft generation
        trackEvent("draft_generated", { request_id: request.id });
      }
    } catch (error) {
      console.error("Failed to generate draft:", error);
      toast.error("Failed to generate draft. Please try again.");
      setShowDraftModal(false);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleViewDraft = () => {
    if (localDraft) {
      setShowDraftModal(true);
    } else {
      generateDraft();
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -2 }}
        className="glass-card p-6 hover-lift"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {showImage ? (
              <img
                src={request.requesterProfileImageUrl!}
                alt={request.requesterName}
                className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                {request.requesterName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{request.requesterName}</h3>
              {request.requesterSubstackUrl ? (
                <a
                  href={request.requesterSubstackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                  title={request.requesterSubstackUrl}
                >
                  <LinkIcon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{extractSubstackName(request.requesterSubstackUrl)}.substack.com</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">No Substack provided</span>
              )}
            </div>
          </div>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border capitalize",
              statusColors[request.status]
            )}
          >
            {request.status}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {request.requestedDate 
                ? `Requested: ${formatDate(request.requestedDate)}`
                : "Flexible - To be scheduled"
              }
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>{request.requesterEmail}</span>
          </div>
        </div>

        {/* Message */}
        {request.message && (
          <div className="bg-muted/50 rounded-xl p-4 mb-4">
            <p className="text-sm text-muted-foreground italic">"{request.message}"</p>
          </div>
        )}

        {/* AI Draft Preview for approved requests */}
        {request.status === "approved" && localDraft && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI Draft Ready</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {localDraft.title}
            </p>
          </motion.div>
        )}

        {/* Actions */}
        {request.status === "pending" && (
          <div className="flex gap-3">
            <Button
              variant="gradient"
              className="flex-1"
              onClick={() => onApprove?.(request.id)}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onDecline?.(request.id)}
            >
              Decline
            </Button>
          </div>
        )}

        {/* Post-approval actions */}
        {request.status === "approved" && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={localDraft ? "outline" : "gradient"}
              size="sm"
              onClick={handleViewDraft}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              {localDraft ? "View Draft" : "Generate Draft"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMessageModal(true)}
              className="flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <CollabDraftModal
        open={showDraftModal}
        onOpenChange={setShowDraftModal}
        draft={localDraft}
        requesterName={request.requesterName}
        isLoading={isGeneratingDraft}
        onRegenerate={generateDraft}
      />

      <SendMessageModal
        open={showMessageModal}
        onOpenChange={setShowMessageModal}
        requestId={request.id}
        requesterName={request.requesterName}
        requesterEmail={request.requesterEmail}
        creatorEmail={creatorEmail || ""}
      />
    </>
  );
}
