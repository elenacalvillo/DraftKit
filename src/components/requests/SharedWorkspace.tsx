import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Save, X, AlertCircle, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface SharedWorkspaceProps {
  requestId: string;
  sharedContent: string | null;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  currentUserName: string;
  canEdit: boolean;
  onContentSaved: (content: string, editedBy: string, editedAt: string) => void;
}

export function SharedWorkspace({
  requestId,
  sharedContent,
  lastEditedBy,
  lastEditedAt,
  currentUserName,
  canEdit,
  onContentSaved,
}: SharedWorkspaceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(sharedContent || "");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = Math.max(300, el.scrollHeight) + "px";
    }
  }, [editContent, isEditing]);

  // Focus textarea on edit
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setEditContent(sharedContent || "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(sharedContent || "");
  };

  const handleSave = async () => {
    setIsSaving(true);
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("collab_requests")
        .update({
          shared_content: editContent || null,
          content_last_edited_by: currentUserName,
          content_last_edited_at: now,
        })
        .eq("id", requestId);

      if (error) throw error;

      onContentSaved(editContent, currentUserName, now);
      setIsEditing(false);
      toast.success("Draft saved & synced");
    } catch (error) {
      console.error("Failed to save workspace content:", error);
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasContent = !!sharedContent?.trim();

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Shared Workspace</span>
        </div>
        {canEdit && !isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEditing}
            className="h-8"
          >
            <PenLine className="w-3.5 h-3.5 mr-1.5" />
            {hasContent ? "Edit Draft" : "Start Writing"}
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-0"
          >
            {/* Anti-collision banner */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 border-b border-accent/20 text-sm text-accent-foreground">
              <AlertCircle className="w-4 h-4 text-accent flex-shrink-0" />
              <span>
                You are currently editing. Remember to <strong>Save & Sync</strong> so others can see your changes.
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Start writing your collaboration draft here..."
              className="w-full min-h-[300px] px-5 py-4 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none font-serif text-[15px] leading-relaxed"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            />

            {/* Edit actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {editContent.length > 0
                  ? `${editContent.split(/\s+/).filter(Boolean).length} words`
                  : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSaving ? "Saving..." : "Save & Sync"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {hasContent ? (
              <>
                <div
                  className="px-5 py-4 min-h-[120px] text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  {sharedContent}
                </div>
                {lastEditedBy && lastEditedAt && (
                  <div className="px-4 py-2.5 border-t border-border/30 text-xs text-muted-foreground bg-muted/10">
                    Last updated by <span className="font-medium text-foreground/70">{lastEditedBy}</span>
                    {" · "}
                    {formatDistanceToNow(new Date(lastEditedAt), { addSuffix: true })}
                  </div>
                )}
              </>
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  No content yet. Start writing to collaborate asynchronously.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
