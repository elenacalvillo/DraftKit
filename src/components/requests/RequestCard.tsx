import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, CalendarDays, ExternalLink, Mail, Link as LinkIcon, Sparkles, MessageSquare, FileText, XCircle, Ban, Check, X, Trash2, PenLine, Copy, MoreHorizontal, Zap } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  onReschedule?: (id: string, newDate: string) => void;
}

const COLLAB_STYLE_OPTIONS = ["Virtual Coffee", "Async Drafting", "Interview Style", "Custom"];

interface EditingSession {
  edited_by: string;
  saved_at: string;
  duration_seconds: number;
}

function TimeSavedBadge({ request }: { request: CollabRequest }) {
  const firstDraft = (request as any).first_draft_generated_at;
  const sessions: EditingSession[] = (request as any).editing_sessions || [];
  
  if (!firstDraft) return null;
  if (request.status !== "approved" && request.status !== "published") return null;

  // SMART draft = 60 min saved
  let totalMinutes = 60;

  // Count async handoffs (different edited_by with >4h gap)
  let handoffs = 0;
  for (let i = 1; i < sessions.length; i++) {
    if (sessions[i].edited_by !== sessions[i - 1].edited_by) {
      const gap = new Date(sessions[i].saved_at).getTime() - new Date(sessions[i - 1].saved_at).getTime();
      if (gap > 4 * 60 * 60 * 1000) handoffs++;
    }
  }
  totalMinutes += handoffs * 45;

  const hours = totalMinutes / 60;
  const display = hours >= 1
    ? `~${hours % 1 === 0 ? hours : hours.toFixed(1)} hrs saved`
    : `~${totalMinutes} min saved`;

  return (
    <div className="flex items-center gap-1.5 mb-3 text-sm text-muted-foreground">
      <Zap className="w-3.5 h-3.5 text-primary/70" />
      <span>{display}</span>
    </div>
  );
}

export function RequestCard({ request, creatorEmail, creatorCollabStyles, canApprove = true, isPro = false, onApprove, onDecline, onCancel, onDraftGenerated, onCollabTypeChanged, onDelete, onReschedule }: RequestCardProps) {
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

  // Reschedule state
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  
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
        // Set first_draft_generated_at if not already set
        if (!(request as any).first_draft_generated_at) {
          await supabase
            .from("collab_requests")
            .update({ first_draft_generated_at: new Date().toISOString() } as any)
            .eq("id", request.id);
        }
        toast.success("SMART Draft generated!");
        trackEvent("draft_generated", { request_id: request.id });
      }
    } catch (error: any) {
      console.error("Failed to generate draft:", error);
      
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
  const isApproved = request.status === "approved";

  // Check if this is a past collab (archive view)
  const isPastCollab = (() => {
    if (!isApproved) return false;
    const dateStr = (request as any).requested_date || (request as any).requestedDate;
    if (!dateStr) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const reqDate = parseDateString(dateStr); reqDate.setHours(0, 0, 0, 0);
    return reqDate < today;
  })();

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -2 }}
        className="glass-card p-6 hover-lift flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
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
              {/* Approved status dot */}
              {isApproved && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" title="Approved" />
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

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Overflow menu for approved cards */}
            {isApproved && !isPastCollab && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setShowMessageModal(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditingLink(true)}>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Link External Doc
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowReschedulePicker(true)}>
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Reschedule
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleViewDraft}>
                    <FileText className="w-4 h-4 mr-2" />
                    {localDraft ? "View SMART Draft" : "Generate SMART Draft"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(request.requesterEmail);
                      toast.success("Email copied!");
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {currentCollabType && (
                    <DropdownMenuItem onClick={() => setIsEditingCollabType(true)}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Change Collab Type
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={() => onCancel?.(request.id)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Collaboration
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Status badge — pill for non-approved, hidden for approved (dot shown on avatar) */}
            {!isApproved && (
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
                  statusColors[request.status] || statusColors.pending
                )}
              >
                {statusLabels[request.status] || request.status}
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-4">
          {/* Collab type editing (inline, triggered from overflow) */}
          {isEditingCollabType && (
            <div className="flex items-center gap-2">
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
          )}

          {/* Collab type tag (read-only, no edit button — edit via overflow) */}
          {currentCollabType && !isEditingCollabType && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{currentCollabType}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="w-4 h-4" />
            <span>
              {request.requestedDate 
                ? `Requested: ${formatDate(request.requestedDate)}`
                : "Flexible - To be scheduled"
              }
            </span>
          </div>

          {/* Inline reschedule date picker */}
          {showReschedulePicker && isApproved && !isPastCollab && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-2">Pick a new date</p>
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(date) => {
                  if (date) {
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    onReschedule?.(request.id, `${yyyy}-${mm}-${dd}`);
                    setShowReschedulePicker(false);
                  }
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today;
                }}
                className="p-3 pointer-events-auto"
              />
              <Button variant="ghost" size="sm" onClick={() => setShowReschedulePicker(false)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Email — compact, with tiny copy icon only for non-approved or keep minimal */}
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
            {/* Tiny copy icon — keep for non-approved, approved has it in overflow */}
            {!isApproved && (
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
            )}
          </div>
        </div>

        {/* Message */}
        {request.message && (
          <div className="bg-muted/50 rounded-xl p-4 mb-4">
            <p className="text-sm text-muted-foreground italic">"{request.message}"</p>
          </div>
        )}

        {/* Collapsed external doc link input (only when triggered from overflow) */}
        {isApproved && isEditingLink && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Paste link (Google Docs, Notion...)"
              value={collabLink}
              onChange={(e) => setCollabLink(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button 
              onClick={handleSaveCollabLink} 
              disabled={isSavingLink}
              size="sm"
            >
              Save
            </Button>
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
          </div>
        )}

        {/* Contextual row: SMART Draft indicator + External Doc link */}
        {isApproved && !isPastCollab && !isEditingLink && (
          <div className="space-y-1 mb-4">
            {localDraft && (
              <button
                onClick={() => setShowDraftModal(true)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <Sparkles className="w-4 h-4 text-primary/70" />
                <span>SMART Draft ready</span>
              </button>
            )}
            {collabLink && !isEditingLink && (
              <a
                href={collabLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>External Doc</span>
              </a>
            )}
          </div>
        )}

        {/* Time Saved Badge */}
        <TimeSavedBadge request={request} />

        {/* ===== ACTIONS ===== */}

        {/* Pending */}
        {request.status === "pending" && (
          <div className="flex gap-3 mt-auto">
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

        {/* Approved — past collab archive view */}
        {isApproved && isPastCollab && (
          <div className="space-y-3 pt-3 border-t mt-auto">
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
        )}

        {/* Approved — upcoming: single primary CTA */}
        {isApproved && !isPastCollab && (
          <div className="mt-auto">
            <Button
              variant="gradient"
              className="w-full"
              onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
            >
              <PenLine className="w-4 h-4 mr-2" />
              {(request as any).shared_content ? "Continue Drafting" : "Start Drafting"}
            </Button>
          </div>
        )}

        {/* Published */}
        {request.status === "published" && (
          <div className="space-y-3 pt-3 border-t mt-auto">
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

        {/* Cancelled */}
        {request.status === "cancelled" && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mt-auto">
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

        {/* Declined */}
        {request.status === "declined" && onDelete && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mt-auto">
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
        requestId={request.id}
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
