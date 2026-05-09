import { useState, useEffect, memo, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspacePresence } from "@/hooks/useWorkspacePresence";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Save, X, AlertCircle, PenLine, Lock, Download, Share2, Copy, Check, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import DOMPurify from "dompurify";
import { WorkspaceEditor } from "./WorkspaceEditor";
import { cn } from "@/lib/utils";
import { exportWorkspaceHtmlToDocx } from "@/lib/export-draft";
import { useAnalytics } from "@/hooks/useAnalytics";
import { parseSaveError } from "@/lib/save-workspace-errors";

const ALLOWED_TAGS = ["p", "h1", "h2", "h3", "strong", "em", "s", "code", "pre", "a", "ul", "ol", "li", "br", "hr", "table", "thead", "tbody", "tr", "th", "td", "span"];
const ALLOWED_ATTR = ["href", "target", "rel", "colspan", "rowspan", "colwidth", "class", "data-comment", "data-author"];

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

interface EditingSession {
  edited_by: string;
  saved_at: string;
  duration_seconds: number;
}

interface SharedWorkspaceProps {
  requestId: string;
  sharedContent: string | null;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  currentUserName: string;
  canEdit: boolean;
  onContentSaved: (content: string, editedBy: string, editedAt: string) => void;
  partnerName?: string;
  isCreator?: boolean;
  editingSessions?: EditingSession[];
  onShareClick?: () => void;
}

// Local recovery draft key per workspace — preserves unsynced edits if a save
// fails, the tab closes, or the network drops mid-write. Cleared only after a
// confirmed backend write.
const recoveryKey = (requestId: string) => `workspace-recovery:${requestId}`;

interface RecoveryDraft {
  content: string;
  saved_at: string; // ISO
  edited_by: string;
}

function readRecoveryDraft(requestId: string): RecoveryDraft | null {
  try {
    const raw = localStorage.getItem(recoveryKey(requestId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.content === "string" && typeof parsed?.saved_at === "string") {
      return parsed as RecoveryDraft;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeRecoveryDraft(requestId: string, draft: RecoveryDraft) {
  try {
    localStorage.setItem(recoveryKey(requestId), JSON.stringify(draft));
  } catch {
    /* quota or disabled — non-fatal */
  }
}

function clearRecoveryDraft(requestId: string) {
  try {
    localStorage.removeItem(recoveryKey(requestId));
  } catch {
    /* ignore */
  }
}

function SaveStatusPill({
  status,
  savedAt,
  visible,
  isEditing,
}: {
  status: "idle" | "unsaved" | "saving" | "saved" | "failed";
  savedAt: string | null;
  visible: boolean;
  isEditing: boolean;
}) {
  if (!visible) return null;
  // While not editing, only surface non-default states.
  if (!isEditing && status !== "failed" && !savedAt) return null;

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="w-3 h-3" />
        Save failed — retrying
      </span>
    );
  }
  if (status === "unsaved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-500">
        <AlertCircle className="w-3 h-3" />
        Unsaved changes
      </span>
    );
  }
  // saved or idle-with-savedAt
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="w-3 h-3 text-success" />
        Saved · {formatDistanceToNow(new Date(savedAt), { addSuffix: true })}
      </span>
    );
  }
  return null;
}

function SharedWorkspaceInner({
  requestId,
  sharedContent,
  lastEditedBy,
  lastEditedAt,
  currentUserName,
  canEdit,
  onContentSaved,
  partnerName,
  isCreator,
  editingSessions = [],
  onShareClick,
}: SharedWorkspaceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(sharedContent || "");
  const [isSaving, setIsSaving] = useState(false);
  const [notifyPartner, setNotifyPartner] = useState(false);
  const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
  const [editStartTime, setEditStartTime] = useState<number | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<RecoveryDraft | null>(null);
  const [editBlockedReason, setEditBlockedReason] = useState<string | null>(null);
  // Save-state machine drives the "Last saved" pill + auto-save loop. Manual
  // and auto saves both feed it so users always see the current truth.
  type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "failed";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(lastEditedAt);
  const [, setNowTick] = useState(0);
  const lastSavedContentRef = useRef<string>(sanitize(sharedContent || ""));
  const inFlightRef = useRef(false);
  const lastFailureToastAtRef = useRef(0);
  const wasFailedRef = useRef(false);
  const editingSessionsRef = useRef(editingSessions);
  useEffect(() => {
    editingSessionsRef.current = editingSessions;
  }, [editingSessions]);
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();

  // Pre-flight permission probe — surface the real reason saves would fail
  // (RLS / status / linkage) BEFORE the user invests time typing.
  useEffect(() => {
    if (!canEdit || !requestId || !user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("can_edit_workspace", { _request_id: requestId });
      if (cancelled) return;
      if (error) {
        setEditBlockedReason(null); // don't block on probe failure; save will surface it
        return;
      }
      const result = (data ?? {}) as { can_edit?: boolean; reason?: string; status?: string };
      if (result.can_edit === false) {
        const friendly =
          result.reason === "not_a_participant"
            ? "Your account isn't linked to this collaboration. Try signing out and back in with the email that received the invite."
            : result.reason === "status_not_approved"
              ? `This collaboration is ${result.status ?? "not active"}, so the workspace is read-only.`
              : result.reason === "request_not_found"
                ? "This collaboration no longer exists."
                : "You don't currently have permission to edit this workspace.";
        setEditBlockedReason(friendly);
      } else {
        setEditBlockedReason(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit, requestId, user]);

  // On mount / when the canonical content changes, check for an unsynced
  // recovery draft that's newer than the backend version. We don't auto-apply
  // it (that would clobber a real partner edit) — we surface a banner letting
  // the user restore it explicitly.
  useEffect(() => {
    const recovery = readRecoveryDraft(requestId);
    if (!recovery) {
      setRecoveryNotice(null);
      return;
    }
    const backendTs = lastEditedAt ? new Date(lastEditedAt).getTime() : 0;
    const recoveryTs = new Date(recovery.saved_at).getTime();
    if (recovery.content === (sharedContent || "")) {
      // Backend already has it (or matches) — safe to drop.
      clearRecoveryDraft(requestId);
      setRecoveryNotice(null);
      return;
    }
    if (recoveryTs > backendTs) {
      setRecoveryNotice(recovery);
    } else {
      // Backend is newer — discard stale local draft.
      clearRecoveryDraft(requestId);
      setRecoveryNotice(null);
    }
  }, [requestId, sharedContent, lastEditedAt]);

  // Presence heartbeat: active while editing
  const { activeEditors } = useWorkspacePresence({
    requestId,
    userId: user?.id,
    userName: currentUserName,
    isEditing,
  });

  // Find the zen header portal target
  useEffect(() => {
    const el = document.getElementById("zen-header-actions");
    setHeaderPortal(el);
  }, []);

  const handleStartEditing = () => {
    // Warn if someone else is currently editing
    if (activeEditors.length > 0) {
      const editorName = activeEditors[0].user_name;
      toast(`${editorName} is currently editing`, {
        description: "Starting your own edit may cause conflicts. Consider waiting.",
        action: {
          label: "Edit Anyway",
          onClick: () => {
            setEditContent(sharedContent || "");
            setIsEditing(true);
            setEditStartTime(Date.now());
          },
        },
      });
      return;
    }
    setEditContent(sharedContent || "");
    setIsEditing(true);
    setEditStartTime(Date.now());
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(sharedContent || "");
    setNotifyPartner(false);
  };

  // While editing, persist a local recovery snapshot on every change so that
  // a network failure / accidental tab close / RLS rejection cannot silently
  // wipe the user's work.
  useEffect(() => {
    if (!isEditing) return;
    const snapshot: RecoveryDraft = {
      content: editContent,
      saved_at: new Date().toISOString(),
      edited_by: currentUserName,
    };
    writeRecoveryDraft(requestId, snapshot);
  }, [editContent, isEditing, requestId, currentUserName]);

  const handleRestoreRecovery = () => {
    if (!recoveryNotice) return;
    setEditContent(recoveryNotice.content);
    setIsEditing(true);
    setEditStartTime(Date.now());
    toast.success("Restored your unsynced draft. Click Save & Sync to keep it.");
  };

  const handleDiscardRecovery = () => {
    clearRecoveryDraft(requestId);
    setRecoveryNotice(null);
  };

  const performSave = useCallback(
    async ({ isAuto, closeOnSuccess }: { isAuto: boolean; closeOnSuccess: boolean }) => {
      if (inFlightRef.current) return;
      if (editBlockedReason) {
        if (!isAuto) {
          toast.error(editBlockedReason, { duration: 8000 });
        }
        return;
      }
      const cleanHtml = sanitize(editContent);
      // No-op auto-save: nothing changed since last confirmed save.
      if (isAuto && cleanHtml === lastSavedContentRef.current) {
        return;
      }
      const now = new Date().toISOString();
      const durationSeconds = editStartTime ? Math.round((Date.now() - editStartTime) / 1000) : 0;
      const newSession: EditingSession = {
        edited_by: currentUserName,
        saved_at: now,
        duration_seconds: durationSeconds,
      };
      const updatedSessions = [...editingSessionsRef.current, newSession];

      inFlightRef.current = true;
      setSaveStatus("saving");
      if (!isAuto) setIsSaving(true);

      try {
        const { data, error } = await supabase.rpc("save_workspace_content", {
          _request_id: requestId,
          _content: cleanHtml,
          _editor_name: currentUserName,
          _editing_sessions: updatedSessions as any,
        });

        if (error) throw error;
        const row = Array.isArray(data) ? (data[0] as any) : (data as any);
        if (!row || !row.id) {
          throw new Error("Server did not confirm the save. Your draft is preserved locally.");
        }

        const confirmedContent: string = row.shared_content ?? "";
        const confirmedBy: string = row.content_last_edited_by ?? currentUserName;
        const confirmedAt: string = row.content_last_edited_at ?? now;

        lastSavedContentRef.current = cleanHtml;
        onContentSaved(confirmedContent, confirmedBy, confirmedAt);
        clearRecoveryDraft(requestId);
        setRecoveryNotice(null);
        setSaveStatus("saved");
        setSavedAt(confirmedAt);

        if (wasFailedRef.current) {
          // Recovery signal — lets us measure save-failure → success rate.
          trackEvent("workspace_save_recovered", {
            request_id: requestId,
            is_auto_save: isAuto,
          });
          wasFailedRef.current = false;
        }

        if (closeOnSuccess) {
          setIsEditing(false);
          toast.success("Draft saved & synced");
          if (notifyPartner && partnerName) {
            const emailType = isCreator
              ? "workspace_updated_by_creator"
              : "workspace_updated_by_guest";
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                supabase.functions.invoke("send-collab-email", {
                  body: { type: emailType, requestId },
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
              }
            } catch {
              /* fire-and-forget */
            }
          }
          setNotifyPartner(false);
        }
      } catch (error) {
        console.error("Failed to save workspace content:", error);
        // Always preserve a fresh local recovery snapshot of the latest edit.
        writeRecoveryDraft(requestId, {
          content: editContent,
          saved_at: new Date().toISOString(),
          edited_by: currentUserName,
        });
        const parsed = parseSaveError(error);
        const pgCode =
          error && typeof error === "object" && "code" in (error as Record<string, unknown>)
            ? String((error as Record<string, unknown>).code ?? "")
            : null;

        // Observability: log every failure so we notice regressions without
        // waiting for users to scream.
        trackEvent("workspace_save_failed", {
          request_id: requestId,
          reason: parsed.reason,
          detail: parsed.detail,
          postgres_code: pgCode,
          is_auto_save: isAuto,
          content_length: cleanHtml.length,
        });

        setSaveStatus("failed");
        wasFailedRef.current = true;

        const nowMs = Date.now();
        const shouldToast = !isAuto || nowMs - lastFailureToastAtRef.current > 30000;
        if (shouldToast) {
          toast.error(
            `CRITICAL: Save Failed. ${parsed.friendly} Your draft is preserved locally on this device — please copy your work manually as a backup.`,
            { duration: 12000 },
          );
          lastFailureToastAtRef.current = nowMs;
        }
      } finally {
        inFlightRef.current = false;
        if (!isAuto) setIsSaving(false);
      }
    },
    [
      editBlockedReason,
      editContent,
      editStartTime,
      currentUserName,
      requestId,
      onContentSaved,
      notifyPartner,
      partnerName,
      isCreator,
      trackEvent,
    ],
  );

  const handleSave = useCallback(
    () => performSave({ isAuto: false, closeOnSuccess: true }),
    [performSave],
  );

  // Auto-save: debounced 3s after the last keystroke. Same RPC, same error
  // path, but silent on success and rate-limited on failure toasts.
  useEffect(() => {
    if (!isEditing) return;
    if (editBlockedReason) return;
    const cleanHtml = sanitize(editContent);
    if (cleanHtml === lastSavedContentRef.current) {
      // Already in sync — make sure the pill reflects that.
      setSaveStatus((s) => (s === "saving" ? s : "saved"));
      return;
    }
    setSaveStatus((s) => (s === "saving" ? s : "unsaved"));
    const t = window.setTimeout(() => {
      performSave({ isAuto: true, closeOnSuccess: false });
    }, 3000);
    return () => window.clearTimeout(t);
  }, [editContent, isEditing, editBlockedReason, performSave]);

  // Keep the "Saved · 12s ago" relative time fresh.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Flush a final save when the user is about to leave with unsynced edits.
  useEffect(() => {
    if (!isEditing) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const cleanHtml = sanitize(editContent);
      if (cleanHtml !== lastSavedContentRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isEditing, editContent]);


  const navigate = useNavigate();

  const handleUpgradeClick = () => {
    toast("Upgrade to Pro to edit this draft", {
      action: {
        label: "Upgrade",
        onClick: () => navigate("/dashboard/settings?upgrade=true"),
      },
    });
  };

  const hasContent = !!sharedContent?.trim();

  // Count words from HTML content
  const wordCount = editContent
    ? new DOMParser().parseFromString(editContent, "text/html").body.textContent?.split(/\s+/).filter(Boolean).length || 0
    : 0;

  return (
    <div className="border border-border/50 rounded-xl bg-card/50">
      {/* Recovery banner — surfaces an unsynced local draft newer than backend */}
      {recoveryNotice && !isEditing && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border/50 bg-accent/10">
          <div className="flex items-center gap-2 text-sm text-accent-foreground">
            <AlertCircle className="w-4 h-4 text-accent flex-shrink-0" />
            <span>
              We found an unsynced draft from{" "}
              {formatDistanceToNow(new Date(recoveryNotice.saved_at), { addSuffix: true })} on this device.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDiscardRecovery}>
              Discard
            </Button>
            <Button variant="gradient" size="sm" className="h-7 text-xs" onClick={handleRestoreRecovery}>
              Restore draft
            </Button>
          </div>
        </div>
      )}
      {/* Edit-blocked banner — shown when pre-flight detects the user can't save here */}
      {editBlockedReason && !isEditing && canEdit && (
        <div className="flex items-start gap-2 px-4 py-2.5 border-b border-border/50 bg-destructive/10 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{editBlockedReason}</span>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Shared Workspace</span>
          </div>
          <SaveStatusPill
            status={saveStatus}
            savedAt={savedAt}
            visible={isEditing || saveStatus === "failed" || (!!savedAt && !isEditing)}
            isEditing={isEditing}
          />
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={async () => {
                try {
                  const html = sharedContent || "";
                  const tmp = document.createElement("div");
                  tmp.innerHTML = html;
                  const plain = tmp.textContent || tmp.innerText || "";
                  const wordCount = plain.split(/\s+/).filter(Boolean).length;

                  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
                    const item = new ClipboardItem({
                      "text/html": new Blob([html], { type: "text/html" }),
                      "text/plain": new Blob([plain], { type: "text/plain" }),
                    });
                    await navigator.clipboard.write([item]);
                  } else {
                    await navigator.clipboard.writeText(plain);
                  }

                  toast.success("Draft copied — you just saved ~30 minutes.");
                  trackEvent("draft_copied", { request_id: requestId, surface: "workspace_copy", word_count: wordCount });
                  trackEvent("draft_accepted", { request_id: requestId, surface: "workspace_copy", word_count: wordCount });
                } catch {
                  toast.error("Couldn't copy. Try selecting and copying manually.");
                }
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy
            </Button>
          )}
          {hasContent && canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={async () => {
                try {
                  await exportWorkspaceHtmlToDocx(sharedContent!, partnerName ? `Drafting with ${partnerName}` : "Workspace Draft");
                  toast.success("Draft downloaded — you just saved ~30 minutes.");
                  trackEvent("draft_accepted", { request_id: requestId, surface: "workspace_download" });
                } catch {
                  toast.error("Failed to download draft");
                }
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download
            </Button>
          )}
          {isCreator && onShareClick && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShareClick}
              className="h-8"
              title="Share or invite collaborators"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              Share
            </Button>
          )}
          {canEdit && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartEditing}
              className="h-8"
              disabled={!!editBlockedReason}
              title={editBlockedReason || undefined}
            >
              <PenLine className="w-3.5 h-3.5 mr-1.5" />
              {hasContent ? "Edit Draft" : "Start Writing"}
            </Button>
          )}
        </div>
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

            <WorkspaceEditor
              content={editContent}
              onChange={setEditContent}
              editable={true}
              currentUserName={currentUserName}
            />

            {/* Zen header portal: Save & Notify */}
            {headerPortal && createPortal(
              <>
                {partnerName && (
                  <label className="hidden sm:flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={notifyPartner}
                      onCheckedChange={(v) => setNotifyPartner(v === true)}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Notify {partnerName.split(" ")[0]}
                    </span>
                  </label>
                )}
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} className="h-8 text-xs">
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button variant="gradient" size="sm" onClick={handleSave} disabled={isSaving} className="h-8 text-xs">
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isSaving ? "Saving…" : "Save & Sync"}
                </Button>
              </>,
              headerPortal
            )}

            {/* Bottom bar: word count + cancel */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {wordCount > 0 ? `${wordCount} words` : ""}
                </span>
                {/* Mobile fallback for notify */}
                {partnerName && (
                  <label className="flex sm:hidden items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={notifyPartner}
                      onCheckedChange={(v) => setNotifyPartner(v === true)}
                    />
                    <span className="text-xs text-muted-foreground">
                      Notify {partnerName.split(" ")[0]}
                    </span>
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                {/* Mobile fallback for save */}
                <Button variant="gradient" size="sm" onClick={handleSave} disabled={isSaving} className="sm:hidden">
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSaving ? "Saving…" : "Save"}
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
              <div className="relative">
                <div
                  className={cn(
                    "workspace-prose px-5 py-4 min-h-[120px] font-sans text-[15px] leading-[1.6] overflow-hidden break-words",
                    !canEdit && "cursor-pointer"
                  )}
                  dangerouslySetInnerHTML={{ __html: sanitize(sharedContent!) }}
                  onClick={!canEdit ? handleUpgradeClick : undefined}
                />
                {!canEdit && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                )}
                {lastEditedBy && lastEditedAt && (
                  <div className="px-4 py-2.5 border-t border-border/30 text-xs text-muted-foreground bg-muted/10">
                    Last updated by <span className="font-medium text-foreground/70">{lastEditedBy}</span>
                    {" · "}
                    {formatDistanceToNow(new Date(lastEditedAt), { addSuffix: true })}
                  </div>
                )}
              </div>
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

// Memoized export — prevents re-render on every Tiptap onChange / parent state
// tick. Without this, every keystroke in the editor was bubbling up and
// re-rendering the whole workspace shell, triggering refetches downstream.
export const SharedWorkspace = memo(SharedWorkspaceInner);
