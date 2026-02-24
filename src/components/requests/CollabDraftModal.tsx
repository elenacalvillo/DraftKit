import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, RefreshCw, Sparkles, User, Users, Clock, CheckCircle, ChevronDown, FileText, Crown, Trash2, PenLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CollabDraft } from "@/lib/storage";
import { useAnalytics } from "@/hooks/useAnalytics";
import { usePro } from "@/hooks/usePro";
import { exportToDocx } from "@/lib/export-draft";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CollabDraftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CollabDraft | null;
  requesterName: string;
  requestId?: string;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

export function CollabDraftModal({
  open,
  onOpenChange,
  draft,
  requesterName,
  requestId,
  isLoading,
  onRegenerate,
  onDelete,
}: CollabDraftModalProps) {
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { trackEvent } = useAnalytics();
  const { isPro } = usePro();
  const navigate = useNavigate();

  const copyToClipboard = () => {
    if (!draft) return;

    const text = `# ${draft.title}

${draft.hook}

## Outline
${draft.outline.map((s) => `- **${s.section}** (${s.contributor}): ${s.description}`).join("\n")}

## Talking Points
${draft.talkingPoints.map((p) => `- ${p}`).join("\n")}

## Format
${draft.suggestedFormat}

## Tone Notes
${draft.toneNotes}

Estimated Read Time: ${draft.estimatedReadTime}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Draft copied to clipboard!");
    trackEvent("draft_copied", { draft_title: draft.title });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToWorkspace = async () => {
    if (!requestId || !draft) return;
    setIsApplying(true);

    try {
      // Format the draft as HTML for the workspace editor
      const draftHtml = `<h1>${draft.title}</h1>
<p><em>${draft.hook}</em></p>
<h2>Outline</h2>
<ul>${draft.outline.map((s) => `<li><strong>${s.section}</strong> (${s.contributor}): ${s.description}</li>`).join("")}</ul>
<h2>Talking Points</h2>
<ul>${draft.talkingPoints.map((p) => `<li>${p}</li>`).join("")}</ul>
<h2>Format</h2>
<p>${draft.suggestedFormat}</p>
<h2>Tone Notes</h2>
<p>${draft.toneNotes}</p>`;

      // Only write to shared_content if it's currently empty
      const { data: current } = await supabase
        .from("collab_requests")
        .select("shared_content")
        .eq("id", requestId)
        .maybeSingle();

      if (!current?.shared_content) {
        await supabase
          .from("collab_requests")
          .update({
            shared_content: draftHtml,
            content_last_edited_by: "SMART Draft",
            content_last_edited_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      trackEvent("draft_applied_to_workspace", { draft_title: draft.title, request_id: requestId });
      onOpenChange(false);
      navigate(`/dashboard/workspace/${requestId}`);
    } catch (error) {
      console.error("Failed to apply draft to workspace:", error);
      toast.error("Failed to apply draft. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  const contributorIcon = (contributor: "creator" | "requester" | "both") => {
    switch (contributor) {
      case "creator":
        return <User className="w-4 h-4" />;
      case "requester":
        return <User className="w-4 h-4" />;
      case "both":
        return <Users className="w-4 h-4" />;
    }
  };

  const contributorLabel = (contributor: "creator" | "requester" | "both") => {
    switch (contributor) {
      case "creator":
        return "You";
      case "requester":
        return requesterName;
      case "both":
        return "Both";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            SMART Draft Workspace
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-12 h-12 text-primary" />
            </motion.div>
            <p className="text-muted-foreground text-center">
              Analyzing both newsletters and generating a collaboration draft...
            </p>
            <p className="text-xs text-muted-foreground/60 text-center">
              This may take up to 30 seconds
            </p>
          </div>
        ) : draft ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Title */}
            <div>
              <h2 className="text-xl font-bold">{draft.title}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {draft.estimatedReadTime}
                </span>
                <Badge variant="secondary">{draft.suggestedFormat}</Badge>
              </div>
            </div>

            {/* Hook */}
            <div className="bg-muted/50 rounded-xl p-4 border-l-4 border-primary">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Opening Hook (Your Voice)
              </p>
              <p className="italic">{draft.hook}</p>
            </div>

            {/* Outline */}
            <div>
              <h3 className="font-semibold mb-3">Outline</h3>
              <div className="space-y-3">
                {draft.outline.map((section, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{section.section}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            section.contributor === "creator" && "border-primary/50 text-primary",
                            section.contributor === "requester" && "border-accent/50 text-accent",
                            section.contributor === "both" && "border-success/50 text-success"
                          )}
                        >
                          {contributorIcon(section.contributor)}
                          <span className="ml-1">{contributorLabel(section.contributor)}</span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ~{section.suggestedLength}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {section.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Talking Points */}
            <div>
              <h3 className="font-semibold mb-3">Talking Points</h3>
              <ul className="space-y-2">
                {draft.talkingPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tone Notes */}
            <div className="bg-accent/10 rounded-xl p-4">
              <p className="text-sm font-medium text-accent mb-2">
                Tone Notes for {requesterName}
              </p>
              <p className="text-sm text-muted-foreground">{draft.toneNotes}</p>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              {/* Primary: Apply to Workspace */}
              {requestId && (
                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={handleApplyToWorkspace}
                  disabled={isApplying}
                >
                  <PenLine className="w-4 h-4 mr-2" />
                  {isApplying ? "Applying…" : "Apply to Workspace"}
                </Button>
              )}

              {/* Secondary row */}
              <div className="flex gap-3">
                {onDelete && (
                  <Button 
                    variant="outline" 
                    onClick={onDelete}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Draft
                  </Button>
                )}

                {/* Copy/Export dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy / Export
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border shadow-md z-50">
                    <DropdownMenuItem
                      onClick={copyToClipboard}
                      className="cursor-pointer"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copied ? "Copied!" : "Copy Raw Text"}
                    </DropdownMenuItem>
                    {isPro ? (
                      <DropdownMenuItem 
                        onClick={async () => {
                          await exportToDocx(draft, requesterName);
                          toast.success("Word document downloaded!");
                          trackEvent("draft_exported_docx", { draft_title: draft.title });
                        }}
                        className="cursor-pointer"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Download as Word (.docx)
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => navigate("/dashboard/settings?upgrade=true")}
                        className="cursor-pointer text-muted-foreground"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Upgrade for Export Options
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {onRegenerate && (
                  <Button variant="outline" onClick={() => {
                    trackEvent("draft_regeneration_requested", { 
                      draft_title: draft?.title 
                    });
                    onRegenerate();
                  }}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            No draft available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
