import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Calendar, ExternalLink, Mail, Link as LinkIcon, Sparkles, MessageSquare, FileText, XCircle, Ban, Edit2, Check, X, Trash2, PenLine, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CollabRequest, CollabDraft } from "@/lib/storage";
import { cn, parseDateString } from "@/lib/utils";
import { CollabDraftModal } from "./CollabDraftModal";
import { SendMessageModal } from "./SendMessageModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { extractSubstackUsername, normalizeSubstackUrl } from "@/lib/substack-url";

interface RequestCardProps {
  request: CollabRequest;
  creatorEmail?: string;
  creatorCollabStyles?: string[];
  canApprove?: boolean;
  isPro?: boolean;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDraftGenerated?: (id: string, draft: CollabDraft) => void;
  onCollabTypeChanged?: (id: string, newType: string) => void;
  onDelete?: (id: string) => void;
}

const COLLAB_STYLE_OPTIONS = ["Virtual Coffee", "Async Drafting", "Interview Style", "Custom"];

export function RequestCard({ request, creatorEmail, creatorCollabStyles, canApprove = true, isPro = false, onApprove, onDecline, onCancel, onDraftGenerated, onCollabTypeChanged, onDelete }: RequestCardProps) {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const [imageError, setImageError] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [localDraft, setLocalDraft] = useState<CollabDraft | null>(
    request.aiDraft as CollabDraft | null
  );
  
  // Collab link state
  const [collabLink, setCollabLink] = useState<string>(
    (request as any).collab_link || ""
  );
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  
  // Collab type editing
  const [isEditingCollabType, setIsEditingCollabType] = useState(false);
  const [editingCollabType, setEditingCollabType] = useState<string>(
    (request as any).selected_collab_type || (request as any).selectedCollabType || ""
  );
  const [isSavingCollabType, setIsSavingCollabType] = useState(false);
  
  const currentCollabType = (request as any).selected_collab_type || (request as any).selectedCollabType;
  
  const handleSaveCollabType = async () => {
    if (!editingCollabType || editingCollabType === currentCollabType) {
      setIsEditingCollabType(false);
      return;
    }
    
    setIsSavingCollabType(true);
    try {
      const { error } = await supabase
        .from('collab_requests')
        .update({ selected_collab_type: editingCollabType })
        .eq('id', request.id);
      
      if (error) throw error;
      
      // Send notification email
      await supabase.functions.invoke('send-collab-email', {
        body: { 
          type: 'collab_type_changed', 
          requestId: request.id,
          newCollabType: editingCollabType 
        }
      });
      
      onCollabTypeChanged?.(request.id, editingCollabType);
      toast.success("Collaboration type updated");
      trackEvent("collab_type_changed", { request_id: request.id, new_type: editingCollabType });
    } catch (error) {
      console.error("Failed to update collab type:", error);
      toast.error("Failed to update collaboration type");
    } finally {
      setIsSavingCollabType(false);
      setIsEditingCollabType(false);
    }
  };

  const handleSaveCollabLink = async () => {
    setIsSavingLink(true);
    try {
      const { error } = await supabase
        .from('collab_requests')
        .update({ collab_link: collabLink || null })
        .eq('id', request.id);
      
      if (error) throw error;
      toast.success("Collaboration link saved");
      setIsEditingLink(false);
    } catch (error) {
      console.error("Failed to save collab link:", error);
      toast.error("Failed to save link");
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleDeleteDraft = async () => {
    try {
      const { error } = await supabase
        .from('collab_requests')
        .update({ ai_draft: null })
        .eq('id', request.id);
      
      if (error) throw error;
      
      setLocalDraft(null);
      setShowDraftModal(false);
      toast.success("Draft deleted");
      trackEvent("draft_deleted", { request_id: request.id });
    } catch (error) {
      console.error("Failed to delete draft:", error);
      toast.error("Failed to delete draft");
    }
  };
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseDateString(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusColors: Record<string, string> = {
    pending: "bg-accent/10 text-accent border-accent/20",
    approved: "bg-success/10 text-success border-success/20",
    declined: "bg-destructive/10 text-destructive border-destructive/20",
    cancelled: "bg-muted text-muted-foreground border-muted-foreground/20",
    published: "bg-success/15 text-success border-success/30",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    declined: "Declined",
    cancelled: "Cancelled",
    published: "✨ Published",
  };

  

  const generateDraft = async () => {
    setIsGeneratingDraft(true);
    setShowDraftModal(true);

    try {
      // Get current session to ensure we have a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error("Your session has expired. Please log in again.");
        setShowDraftModal(false);
        setIsGeneratingDraft(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("generate-collab-draft", {
        body: { requestId: request.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.draft) {
        setLocalDraft(data.draft);
        onDraftGenerated?.(request.id, data.draft);
        toast.success("Collaboration draft generated!");
        
        // Track draft generation
        trackEvent("draft_generated", { request_id: request.id });
      }
    } catch (error: any) {
      console.error("Failed to generate draft:", error);
      
      // Handle specific auth errors
      if (error?.message?.includes('401') || error?.message?.includes('auth') || error?.message?.includes('Unauthorized')) {
        toast.error("Authentication failed. Please refresh the page and try again.");
      } else {
        toast.error("Failed to generate draft. Please try again.");
      }
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

  const showImage = request.requesterProfileImageUrl && !imageError;

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
            <div className="relative">
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
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{request.requesterName}</h3>
              {request.requesterSubstackUrl ? (
                <a
                  href={normalizeSubstackUrl(request.requesterSubstackUrl).normalized || request.requesterSubstackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                  title={request.requesterSubstackUrl}
                >
                  <LinkIcon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {extractSubstackUsername(request.requesterSubstackUrl)
                      ? `${extractSubstackUsername(request.requesterSubstackUrl)}.substack.com`
                      : request.requesterSubstackUrl}
                  </span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">No Substack provided</span>
              )}
            </div>
          </div>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border",
              statusColors[request.status] || statusColors.pending
            )}
          >
            {statusLabels[request.status] || request.status}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-4">
          {/* Collab Type Display/Edit */}
          {currentCollabType && (
            <div className="flex items-center gap-2">
              {isEditingCollabType ? (
                <div className="flex items-center gap-2 flex-1">
                  <Select
                    value={editingCollabType}
                    onValueChange={setEditingCollabType}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(creatorCollabStyles || COLLAB_STYLE_OPTIONS).map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSaveCollabType}
                    disabled={isSavingCollabType}
                  >
                    <Check className="w-4 h-4 text-success" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsEditingCollabType(false);
                      setEditingCollabType(currentCollabType);
                    }}
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{currentCollabType}</span>
                  {request.status === "approved" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1"
                      onClick={() => setIsEditingCollabType(true)}
                      title="Change collaboration type"
                    >
                      <Edit2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {request.requestedDate 
                ? `Requested: ${formatDate(request.requestedDate)}`
                : "Flexible - To be scheduled"
              }
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`mailto:${request.requesterEmail}`}
              aria-label="Send email to requester"
              title="Send email"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>Email</span>
            </a>
            <button
              onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(request.requesterEmail);
                toast.success("Email copied!");
              }}
              title="Copy email address"
              className="p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
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
              <span className="text-sm font-medium text-primary">Draft Ready</span>
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
              disabled={!canApprove}
            >
              {canApprove ? "Approve" : "Limit Reached"}
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

        {/* Post-approval actions — past collabs show archive view */}
        {request.status === "approved" && (() => {
          const dateStr = (request as any).requested_date || (request as any).requestedDate;
          if (dateStr) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const reqDate = parseDateString(dateStr); reqDate.setHours(0, 0, 0, 0);
            if (reqDate < today) {
              return (
                <div className="space-y-3 pt-3 border-t mt-3">
                  <div className="flex items-center gap-2 text-sm text-success font-medium">
                    <Check className="w-4 h-4" />
                    <span>Collaboration milestone reached</span>
                  </div>
                  <Button
                    variant="gradient"
                    className="w-full"
                    onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
                  >
                    <PenLine className="w-4 h-4 mr-2" />
                    View Final Workspace
                  </Button>
                </div>
              );
            }
          }
          // Upcoming approved collab — show full action block
          return (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={localDraft ? "outline" : "gradient"}
                  size="sm"
                  onClick={handleViewDraft}
                  className="flex-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {localDraft ? "View AI Draft" : "Generate Draft"}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel?.(request.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>

              {/* Collaboration Link Section */}
              <div className="space-y-2">
                {collabLink && !isEditingLink ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(collabLink, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open External Document
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setIsEditingLink(true)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Optional: link an external doc (Google Docs, Notion...)"
                      value={collabLink}
                      onChange={(e) => setCollabLink(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSaveCollabLink} 
                      disabled={isSavingLink}
                      size="sm"
                    >
                      Save
                    </Button>
                    {isEditingLink && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setIsEditingLink(false);
                          setCollabLink((request as any).collab_link || "");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Start/Continue Drafting Button */}
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
              >
                <PenLine className="w-4 h-4 mr-2" />
                {(request as any).shared_content ? "Continue Drafting" : "Start Drafting"}
              </Button>
            </div>
          );
        })()}

        {/* Published — celebratory archive view */}
        {request.status === "published" && (
          <div className="space-y-3 pt-3 border-t mt-3">
            <div className="flex items-center gap-2 text-sm text-success font-medium">
              <Sparkles className="w-4 h-4" />
              <span>This collaboration is published!</span>
            </div>
            <Button
              variant="outline"
              className="w-full border-success/30 text-success hover:bg-success/10"
              onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Final Workspace
            </Button>
          </div>
        )}

        {/* Cancelled status indicator with delete option */}

        {request.status === "cancelled" && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Ban className="w-4 h-4" />
              <span className="text-sm">This collaboration was cancelled.</span>
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(request.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Dismiss"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {request.status === "declined" && onDelete && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Ban className="w-4 h-4" />
              <span className="text-sm">This request was declined.</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(request.id)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Dismiss"
            >
              <Trash2 className="w-4 h-4" />
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
        onDelete={handleDeleteDraft}
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
