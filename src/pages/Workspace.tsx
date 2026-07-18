import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CalendarDays,
  ExternalLink,
  LinkIcon,
  Mail,
  Sparkles,
  FileText,
  MessageSquare,
  PenLine,
  Lock,
  X,
  PartyPopper,
  CheckCircle2,
  Copy,
  Check,
  Crown,
  Clock,
  XCircle,
  UserPlus,
  Users,
  AlertCircle,
  User,
  FolderInput,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SharedWorkspace } from "@/components/requests/SharedWorkspace";
import { CollabDraftModal } from "@/components/requests/CollabDraftModal";
import { SendMessageModal } from "@/components/requests/SendMessageModal";
import { GuestMessageModal } from "@/components/requests/GuestMessageModal";
import { WorkspaceConversation } from "@/components/requests/WorkspaceConversation";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePro } from "@/hooks/usePro";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { CollabDraft } from "@/lib/storage";
import { CollabImpactCard } from "@/components/requests/CollabImpactCard";
import { InviteCollaboratorModal } from "@/components/requests/InviteCollaboratorModal";
import { EditableChapterTitle } from "@/components/projects/EditableChapterTitle";
import { ChapterNavigator } from "@/components/projects/ChapterNavigator";
import { MoveChapterDialog } from "@/components/projects/MoveChapterDialog";
import { ChapterHistoryDrawer } from "@/components/projects/ChapterHistoryDrawer";
import { useProjectChapters } from "@/hooks/useProjectChapters";
import { useProjectMemberRole } from "@/hooks/useProjectMemberRole";
import { isCommentOnlyRole } from "@/lib/access";
import { parseDateString, cn, sanitizeSubstackImageUrl } from "@/lib/utils";
import { extractSubstackUsername, normalizeSubstackUrl } from "@/lib/substack-url";
import { toast } from "sonner";
import { useWorkspacePresence } from "@/hooks/useWorkspacePresence";
import { useWorkspaceCollaborators } from "@/hooks/useWorkspaceCollaborators";
import {
  isInvitedCollaborator as deriveIsInvitedCollaborator,
  getMessagePartnerLabel,
} from "@/lib/workspace-roles";
import { isEffectivelySolo } from "@/lib/workspace-participants";

interface WorkspaceRequest {
  id: string;
  creator_id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_substack_url: string | null;
  requester_profile_image_url: string | null;
  requester_user_id: string | null;
  message: string | null;
  requested_date: string | null;
  status: string;
  created_at: string;
  ai_draft: unknown;
  collab_link: string | null;
  shared_content: string | null;
  content_last_edited_by: string | null;
  content_last_edited_at: string | null;
  selected_collab_type: string | null;
  is_solo: boolean;
  is_project_workspace?: boolean;
  project_id?: string | null;
}

interface CreatorInfo {
  id: string;
  name: string;
  username: string;
  profile_image_url: string | null;
  substack_url: string | null;
}

export default function Workspace() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, creator, loading: authLoading } = useAuth();
  const { isPro, canHostMore } = usePro();
  const { trackEvent } = useAnalytics();

  const [request, setRequest] = useState<WorkspaceRequest | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Role
  const isCreator = !!creator && creator.id === request?.creator_id;
  const isGuest = !!user && user.id === request?.requester_user_id;

  // useAdmin retained for downstream hooks even though isAdmin is unused here.
  useAdmin();

  // Modals
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [localDraft, setLocalDraft] = useState<CollabDraft | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [msgRefreshKey, setMsgRefreshKey] = useState(0);
  const [showMoveChapter, setShowMoveChapter] = useState(false);
  const [retroDismissed, setRetroDismissed] = useState(
    () => localStorage.getItem(`retro-dismissed-${requestId}`) === "true",
  );
  const [publishAnswer, setPublishAnswer] = useState<string | null>(null);
  const [publishUrls, setPublishUrls] = useState<{ creatorUrl: string; requesterUrl: string }>({
    creatorUrl: "",
    requesterUrl: "",
  });
  const [isSavingPublish, setIsSavingPublish] = useState(false);
  // undefined = loading, null = not answered, {message} = already answered
  const [existingRetroFeedback, setExistingRetroFeedback] = useState<{ message: string } | null | undefined>(undefined);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingCollaborator, setRemovingCollaborator] = useState<{ id: string; name: string } | null>(null);

  // Collaborators & presence
  const { collaborators, refetch: refetchCollaborators } = useWorkspaceCollaborators(requestId || "");
  const { activeEditors } = useWorkspacePresence({
    requestId: requestId || "",
    userId: user?.id,
    userName: creator?.name || request?.requester_name || "User",
    isEditing: false, // Workspace page doesn't track editing — SharedWorkspace does
  });

  // Credits for invite gating
  const [credits, setCredits] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("creators")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCredits(data?.credits ?? 0));
  }, [user?.id]);

  // On mount, check if the user has already answered the retrospective check-in
  useEffect(() => {
    if (!requestId || !user) return;
    supabase
      .from("user_feedback")
      .select("message")
      .eq("user_id", user.id)
      .eq("page_url", `/dashboard/workspace/${requestId}`)
      .eq("feedback_type", "praise")
      .maybeSingle()
      .then(({ data }) => setExistingRetroFeedback(data ?? null));
  }, [requestId, user]);

  // Restore publishAnswer from DB record
  useEffect(() => {
    if (!existingRetroFeedback) return;
    if (existingRetroFeedback.message.includes("= yes")) setPublishAnswer("yes");
    else if (existingRetroFeedback.message.includes("= not_yet")) setPublishAnswer("not_yet");
  }, [existingRetroFeedback]);

  const handleMessageSent = useCallback(() => {
    setMsgRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (user && requestId) {
      fetchRequest();
    }
  }, [user, requestId]);

  // Mark this workspace as read for the current user so the unread badge
  // on Collaborations / Dashboard clears the next time they view the feed.
  useEffect(() => {
    if (!user?.id || !requestId) return;
    supabase.rpc("mark_workspace_read", { _request_id: requestId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["my_workspaces"] });
    });
  }, [user?.id, requestId, queryClient]);

  // Fetch sibling booked dates for reschedule conflict prevention
  useEffect(() => {
    if (!request?.creator_id || !requestId) return;
    supabase
      .from("collab_requests")
      .select("requested_date")
      .eq("creator_id", request.creator_id)
      .in("status", ["approved", "published"])
      .neq("id", requestId)
      .not("requested_date", "is", null)
      .then(({ data }) => {
        if (data) setBookedDates(data.map((r) => r.requested_date!));
      });
  }, [request?.creator_id, requestId]);

  const fetchRequest = async () => {
    try {
      // Use SECURITY DEFINER RPC so collaborator viewers don't see requester PII.
      // Owners and the original requester get the full row; collaborators get
      // PII fields (email, name, profile image, substack url, retro notes) as null.
      const { data: rows, error } = await supabase.rpc("get_workspace_request", {
        _request_id: requestId!,
      });
      const data = Array.isArray(rows) ? (rows[0] as any) : (rows as any);

      if (error || !data) {
        trackEvent("workspace_access_denied", {
          request_id: requestId,
          reason: error?.message || "no_row",
        });
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Resolve missing requester profile image from their creator profile
      let resolvedData: any = data;
      if (!data.requester_profile_image_url && data.requester_user_id) {
        const { data: reqCreator } = await supabase
          .from("creators")
          .select("profile_image_url")
          .eq("user_id", data.requester_user_id)
          .maybeSingle();
        if (reqCreator?.profile_image_url) {
          resolvedData = { ...data, requester_profile_image_url: reqCreator.profile_image_url };
        }
      }

      // Fetch project context (project_id / is_project_workspace) — not in
      // get_workspace_request payload. Owner & requester can SELECT this row
      // directly via existing RLS policies.
      const { data: ctx } = await supabase
        .from("collab_requests")
        .select("project_id, is_project_workspace, chapter_order")
        .eq("id", requestId!)
        .maybeSingle();
      if (ctx) {
        resolvedData = { ...resolvedData, project_id: ctx.project_id, is_project_workspace: ctx.is_project_workspace, chapter_order: ctx.chapter_order } as any;
      }

      setRequest(resolvedData as WorkspaceRequest);
      setLocalDraft((data.ai_draft as unknown as CollabDraft) || null);

      // Fetch creator info
      const { data: cInfo } = await supabase
        .from("public_creator_profiles")
        .select("id, name, username, profile_image_url, substack_url")
        .eq("id", data.creator_id)
        .maybeSingle();

      setCreatorInfo(cInfo as CreatorInfo | null);

      // Stamp joined_at for invited collaborators the first time they
      // open the workspace — keeps the Writer's Room "Joined" badge truthful.
      // No-op for owner/requester; safe for already-stamped rows.
      supabase.rpc("stamp_collaborator_joined", { _request_id: requestId! }).then(() => {});

      trackEvent("workspace_opened", {
        request_id: requestId,
        status: data.status,
        is_solo: !!data.is_solo,
      });
    } catch (err) {
      console.error("Error fetching workspace request:", err);
      trackEvent("workspace_access_denied", {
        request_id: requestId,
        reason: "exception",
      });
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const generateDraft = async () => {
    setIsGeneratingDraft(true);
    setShowDraftModal(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired. Please log in again.");
        setShowDraftModal(false);
        setIsGeneratingDraft(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("generate-collab-draft", {
        body: { requestId: request!.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.draft) {
        setLocalDraft(data.draft);
        // Set first_draft_generated_at if not already set
        if (!(request as any).first_draft_generated_at) {
          await supabase
            .from("collab_requests")
            .update({ first_draft_generated_at: new Date().toISOString() } as any)
            .eq("id", request!.id);
          setRequest((prev) =>
            prev ? ({ ...prev, first_draft_generated_at: new Date().toISOString() } as any) : prev,
          );
        }
        toast.success("SMART draft ready — review and click Apply to Workspace.");
        trackEvent("draft_generated", { request_id: request!.id });
      }
    } catch (error) {
      console.error("Failed to generate draft:", error);
      toast.error("Failed to generate draft. Please try again.");
      setShowDraftModal(false);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleDeleteDraft = async () => {
    try {
      const { error } = await supabase.from("collab_requests").update({ ai_draft: null }).eq("id", request!.id);
      if (error) throw error;
      setLocalDraft(null);
      setShowDraftModal(false);
      toast.success("Draft deleted");
    } catch (error) {
      console.error("Failed to delete draft:", error);
      toast.error("Failed to delete draft");
    }
  };

  const handleViewDraft = () => {
    if (localDraft) {
      setShowDraftModal(true);
    } else {
      generateDraft();
    }
  };

  const handleReschedule = async (newDate: string) => {
    if (!creator || !request) return;
    const oldDate = request.requested_date;
    const { error } = await supabase.from("collab_requests").update({ requested_date: newDate }).eq("id", request.id);
    if (error) {
      toast.error("Failed to reschedule");
      return;
    }
    const { data: availData } = await supabase
      .from("availability")
      .select("*")
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (availData) {
      let dates: string[] = availData.available_dates || [];
      if (oldDate && !dates.includes(oldDate)) dates = [...dates, oldDate];
      dates = dates.filter((d: string) => d !== newDate);
      await supabase.from("availability").update({ available_dates: dates }).eq("id", availData.id);
    }
    setRequest((prev) => (prev ? { ...prev, requested_date: newDate } : prev));
    setShowReschedulePicker(false);
    const formattedNew = parseDateString(newDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    toast.success(`Rescheduled to ${formattedNew}. Old slot restored.`);
    trackEvent("collab_rescheduled", { request_id: request.id, new_date: newDate });
    supabase.functions
      .invoke("send-collab-email", {
        body: { type: "collab_rescheduled", requestId: request.id, newDate },
      })
      .catch((err) => console.error("Failed to send reschedule email:", err));
  };

  const currentUserName = isCreator ? creator!.name : request?.requester_name || "Guest";

  const backPath = request?.is_project_workspace && request?.project_id
    ? `/dashboard/projects/${request.project_id}`
    : "/dashboard/collaborations";

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

  // Solo workspace detection — a room is *effectively* solo when the flag
  // is set OR the creator and requester resolve to the same identity (which
  // is the shape of every book-project chapter room).
  const isSolo = isEffectivelySolo({
    isSolo: !!(request as any)?.is_solo,
    creatorUserId: request?.creator_id,
    requesterUserId: (request as any)?.requester_user_id,
    creatorName: creatorInfo?.name,
    requesterName: request?.requester_name,
  });

  // Third user type: invited collaborators (from workspace_collaborators)
  // are neither the creator nor the original requester. They get the same
  // restricted UI as guests — owner-only controls stay hidden.
  const isInvitedCollaborator = deriveIsInvitedCollaborator(
    user?.id,
    collaborators,
  );
  const isOwnerView = isCreator;
  const isGuestView = isGuest || isInvitedCollaborator;

  // Hide the current viewer from the collaborator list — we never want to
  // show the logged-in user as their own "partner".
  const currentUserEmail = user?.email?.toLowerCase() || null;
  const visibleCollaborators = collaborators.filter((c) => {
    if (user?.id && c.user_id && c.user_id === user.id) return false;
    if (currentUserEmail && c.email && c.email.toLowerCase() === currentUserEmail) return false;
    return true;
  });

  // Partner resolution:
  //  - Host viewing → first invited collaborator, else the classic requester.
  //  - Guest/collaborator viewing → the host (creatorInfo).
  //  - Truly solo → null (button falls back to "Message Partner").
  const guestCandidate = visibleCollaborators[0];
  const partnerName = isCreator
    ? guestCandidate?.display_name || (!isSolo ? request?.requester_name : null) || null
    : creatorInfo?.name || null;
  const partnerSubstackUrl = isCreator
    ? (!isSolo ? request?.requester_substack_url : null)
    : creatorInfo?.substack_url;
  const partnerProfileImage = isCreator
    ? guestCandidate?.profile_image_url || (!isSolo ? request?.requester_profile_image_url : null) || null
    : creatorInfo?.profile_image_url;

  const messageRecipientName = partnerName || "Partner";

  // Position-based chapter number, matching the project detail list.
  const { chapters: projectChapters } = useProjectChapters(
    request?.is_project_workspace ? request?.project_id ?? undefined : undefined,
  );
  const chapterPosition = (() => {
    if (!request?.is_project_workspace || !request?.project_id) return null;
    const idx = projectChapters.findIndex((c) => c.id === request.id);
    return idx >= 0 ? idx + 1 : null;
  })();

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (notFound || !request) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Workspace not found</h2>
          <p className="text-muted-foreground mb-6">This collaboration doesn't exist or you don't have access.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (request.status !== "approved" && request.status !== "published") {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Workspace unavailable</h2>
          <p className="text-muted-foreground mb-6">The workspace is only available for approved collaborations.</p>
          <Button variant="outline" onClick={() => navigate(backPath)}>
            Back to Collabs
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Workspace is always accessible for approved/published collabs — no pro gate here.
  // The gate is on the booking page (incoming requests) and the publish action.

  // Retrospective banner logic
  const isRetroEligible = (() => {
    if (!request?.requested_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reqDate = parseDateString(request.requested_date);
    reqDate.setHours(0, 0, 0, 0);
    return reqDate <= today;
  })();

  const retroDismissKey = `retro-dismissed-${requestId}`;

  // Step 1: User clicks Yes/Not yet — for "yes", show URL form instead of immediately publishing
  const handlePublishAnswer = (answer: "yes" | "not_yet") => {
    // Gate: check if free-tier user has exhausted their host capacity
    if (answer === "yes" && !canHostMore) {
      toast.error("You've reached your host capacity", {
        description: "Invite friends or upgrade to Pro to publish more collabs.",
        action: {
          label: "Upgrade",
          onClick: () => navigate("/dashboard/subscription"),
        },
      });
      return;
    }
    setPublishAnswer(answer);
    if (answer === "yes") {
      // Pre-fill creator URL if collab_link exists
      setPublishUrls({ creatorUrl: request?.collab_link || "", requesterUrl: "" });
    } else {
      // "Not yet" — just log feedback
      logPublishFeedback("not_yet");
      toast.success("No rush — we'll be here when it's ready!");
    }
  };

  // Step 2: Submit post URLs, update status, trigger metrics
  const handlePublishWithUrls = async () => {
    if (!requestId || !user?.id) return;
    setIsSavingPublish(true);
    try {
      // Save URLs + flip status to published
      const updatePayload: Record<string, unknown> = { status: "published" };
      if (publishUrls.creatorUrl.trim()) updatePayload.collab_link = publishUrls.creatorUrl.trim();
      if (publishUrls.requesterUrl.trim()) updatePayload.requester_collab_link = publishUrls.requesterUrl.trim();

      const { error: publishError } = await supabase.from("collab_requests").update(updatePayload as never).eq("id", requestId);

      if (publishError) {
        console.error("[Workspace] Failed to update status to published:", publishError);
        toast.error("Couldn't mark as published — please try again.");
        setIsSavingPublish(false);
        return;
      }

      setRequest((prev) => (prev ? ({ ...prev, ...updatePayload, status: "published" } as any) : prev));

      // Status update succeeded — show success immediately (DB is source of truth)
      toast.success("Congrats on publishing! 🎉 Engagement data is being collected.");

      // Non-fatal background tasks — errors are swallowed so the user never sees them
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const emailResult = await supabase.functions.invoke("send-collab-email", {
            body: { type: "collab_published", requestId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (emailResult?.error) console.error("collab_published email error (non-fatal):", emailResult.error);
        }
      } catch (emailErr) {
        console.error("Failed to send collab_published email (non-fatal):", emailErr);
      }

      try {
        const metricsResult = await supabase.functions.invoke("fetch-collab-metrics", {
          body: { requestId, snapshotDay: 0 },
        });
        if (metricsResult?.error) console.error("Metrics snapshot error (non-fatal):", metricsResult.error);
      } catch (metricsErr) {
        console.error("Failed to trigger metrics snapshot (non-fatal):", metricsErr);
      }

      // Log feedback
      await logPublishFeedback("yes");
    } finally {
      setIsSavingPublish(false);
    }
  };

  const logPublishFeedback = async (answer: string) => {
    try {
      await supabase.from("user_feedback").insert({
        user_id: user?.id || null,
        email: user?.email || null,
        feedback_type: "praise",
        message: `Post-collab check-in: Published = ${answer}. Collab with ${partnerName}, request ${requestId}.`,
        page_url: window.location.pathname,
      });
    } catch (e) {
      console.error("Feedback log failed (non-fatal):", e);
    }
  };

  const dismissRetro = () => {
    setRetroDismissed(true);
    localStorage.setItem(retroDismissKey, "true");
  };

  return (
    <DashboardLayout
      zenMode
      zenTitle={
        isSolo ? (
          <span className="inline-flex items-center gap-1.5 min-w-0 justify-center">
            <span className="text-muted-foreground shrink-0 hidden sm:inline">Drafting:</span>
            <EditableChapterTitle
              chapterId={request.id}
              title={request.message || "Untitled Project"}
              canEdit={isCreator || request.requester_user_id === user?.id}
              variant="header"
              prefix={
                chapterPosition ? `Ch. ${chapterPosition}.` : undefined
              }
              onSaved={(t) => setRequest((prev) => (prev ? { ...prev, message: t } : prev))}
            />
            {request.is_project_workspace && request.project_id && (
              <ChapterNavigator
                projectId={request.project_id}
                currentChapterId={request.id}
              />
            )}
            {request.is_project_workspace && request.project_id && isCreator && (
              <button
                onClick={() => setShowMoveChapter(true)}
                className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                title="Move this chapter to another project"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Move</span>
              </button>
            )}
          </span>
        ) : (
          `Drafting with ${partnerName}`
        )
      }
      zenBackPath={backPath}
    >
      <div className="max-w-6xl mx-auto min-w-0">
        {/* Retrospective Banner */}
        <AnimatePresence>
          {isRetroEligible && !retroDismissed && (
            <motion.div
              key={existingRetroFeedback !== undefined ? (existingRetroFeedback ? "saved" : "prompt") : "loading"}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={cn(
                "glass-card p-5 mb-6 border-l-4 relative",
                existingRetroFeedback ? "border-l-success" : "border-l-primary",
              )}
            >
              <button
                onClick={dismissRetro}
                className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Saved state — already answered */}
              {existingRetroFeedback ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-tight">Experience saved</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {publishAnswer === "yes"
                          ? "You marked this collab as published 🎉"
                          : publishAnswer === "not_yet"
                            ? "You noted it's not published yet — no rush!"
                            : `Collab with ${partnerName} — ${formatDate(request.requested_date)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Recovery button: feedback says "yes" but status never updated */}
                    {publishAnswer === "yes" && request.status !== "published" && isPro && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success/40 hover:bg-success/10"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("collab_requests")
                            .update({ status: "published" })
                            .eq("id", requestId);
                          if (error) {
                            toast.error("Couldn't mark as published — please try again.");
                          } else {
                            setRequest((prev) => (prev ? { ...prev, status: "published" } : prev));
                            toast.success("Marked as published! 🎉");
                          }
                        }}
                      >
                        Mark as Published
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("open-feedback-widget"));
                      }}
                    >
                      Add More Feedback
                    </Button>
                  </div>
                </div>
              ) : (
                /* Prompt state — not yet answered */
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <PartyPopper className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Milestone reached!</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your collab with <strong>{partnerName}</strong> was scheduled for{" "}
                    <strong>{formatDate(request.requested_date)}</strong>. How did it go?
                  </p>

                  <div className="space-y-3">
                    {existingRetroFeedback === null && (
                      <>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium">Was this published?</span>
                          {publishAnswer ? (
                            <Badge variant="secondary">{publishAnswer === "yes" ? "✅ Yes" : "⏳ Not yet"}</Badge>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handlePublishAnswer("yes")}>
                                Yes
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handlePublishAnswer("not_yet")}>
                                Not yet
                              </Button>
                            </>
                          )}
                          <div className="ml-auto">
                            <Button
                              size="sm"
                              variant="gradient"
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent("open-feedback-widget"));
                              }}
                            >
                              Share Your Experience
                            </Button>
                          </div>
                        </div>

                        {/* URL input form after clicking "Yes" */}
                        {publishAnswer === "yes" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-3 pt-2 border-t border-border/50"
                          >
                            <p className="text-sm text-muted-foreground">
                              Paste the published post URLs so we can track engagement:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Your post URL
                                </label>
                                <input
                                  type="text"
                                  placeholder="https://you.substack.com/p/..."
                                  value={publishUrls.creatorUrl}
                                  onChange={(e) => setPublishUrls((prev) => ({ ...prev, creatorUrl: e.target.value }))}
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Guest's post URL (optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="https://guest.substack.com/p/..."
                                  value={publishUrls.requesterUrl}
                                  onChange={(e) =>
                                    setPublishUrls((prev) => ({ ...prev, requesterUrl: e.target.value }))
                                  }
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="hero"
                                onClick={handlePublishWithUrls}
                                disabled={isSavingPublish}
                              >
                                {isSavingPublish ? "Saving…" : "Confirm & Track Engagement"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={handlePublishWithUrls}
                                disabled={isSavingPublish}
                              >
                                Skip — publish without URLs
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[280px_1fr]">
          {/* Left Panel — Context Sidebar (renders BELOW editor on mobile) */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 min-w-0">

            {/* Partner Card / Solo Project Card */}
            <div className="glass-card p-5 space-y-4">
              {isSolo && collaborators.length === 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Solo Draft</p>
                  <h3 className="font-semibold text-lg">{request.message || "Untitled Project"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Invite collaborators when you're ready.</p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {partnerProfileImage ? (
                    <img
                      src={sanitizeSubstackImageUrl(partnerProfileImage)}
                      alt={partnerName || ""}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
                      {(partnerName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{partnerName}</h3>
                    {partnerSubstackUrl && (
                      <a
                        href={normalizeSubstackUrl(partnerSubstackUrl).normalized || partnerSubstackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                      >
                        <LinkIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {extractSubstackUsername(partnerSubstackUrl)
                            ? `${extractSubstackUsername(partnerSubstackUrl)}.substack.com`
                            : partnerSubstackUrl}
                        </span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <Badge variant="secondary" className="capitalize">
                {request.selected_collab_type || "Collaboration"}
              </Badge>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {request.requested_date ? formatDate(request.requested_date) : "Flexible — To be scheduled"}
                </span>
                {isCreator &&
                  request.status === "approved" &&
                  (() => {
                    if (!request.requested_date) return true;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const rd = parseDateString(request.requested_date);
                    rd.setHours(0, 0, 0, 0);
                    return rd >= today;
                  })() && (
                    <button
                      onClick={() => setShowReschedulePicker(!showReschedulePicker)}
                      className="ml-1 p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Reschedule"
                    >
                      <CalendarDays className="w-4 h-4" />
                    </button>
                  )}
              </div>

              {/* Reschedule date picker dialog */}
              <Dialog open={showReschedulePicker && isCreator} onOpenChange={setShowReschedulePicker}>
                <DialogContent className="sm:max-w-[350px] p-0">
                  <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle className="text-base">Reschedule</DialogTitle>
                  </DialogHeader>
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={(date) => {
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, "0");
                        const dd = String(date.getDate()).padStart(2, "0");
                        handleReschedule(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    modifiers={{
                      booked: bookedDates.map((d) => parseDateString(d)),
                    }}
                    modifiersClassNames={{
                      booked: "bg-destructive/20 text-destructive line-through",
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date < today) return true;
                      const yyyy = date.getFullYear();
                      const mm = String(date.getMonth() + 1).padStart(2, "0");
                      const dd = String(date.getDate()).padStart(2, "0");
                      return bookedDates.includes(`${yyyy}-${mm}-${dd}`);
                    }}
                    className="p-3 pointer-events-auto mx-auto"
                  />
                </DialogContent>
              </Dialog>

              {/* Email — hide for solo workspaces and for collaborators (RPC returns null email for them) */}
              {!isSolo && request.requester_email && (
                <div className="flex items-center gap-1">
                  <a
                    href={`mailto:${request.requester_email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span>Send Email</span>
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(request.requester_email!);
                      toast.success("Email copied!");
                    }}
                    title="Copy email address"
                    className="ml-1 p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Message — for solo workspaces, message holds the project title (shown above), so skip */}
            {request.message && !isSolo && (
              <div className="glass-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  Original Message
                </p>
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{request.message}"</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {isCreator && (
                <div className="space-y-1.5">
                  <Button
                    variant={localDraft ? "outline" : "gradient"}
                    size="sm"
                    onClick={handleViewDraft}
                    className="w-full"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {localDraft ? "View SMART Draft" : "Generate SMART Draft"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground leading-snug px-0.5">
                    Optional. DraftKit never stores your writing or uses it to train any language model.
                  </p>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setShowMessageModal(true)} className="w-full">
                <MessageSquare className="w-4 h-4 mr-2" />
                {getMessagePartnerLabel(partnerName)}
              </Button>

              {request.collab_link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(request.collab_link!, "_blank")}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {request.status === "published" ? "See Live Post" : "Open External Document"}
                </Button>
              )}

              {isOwnerView && request.status === "approved" && (() => {
                const isChapter = !!request.is_project_workspace;
                return (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {isChapter ? "Delete Chapter" : "Cancel Collab"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {isChapter ? "Delete this chapter?" : "Cancel this collaboration?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {isChapter
                            ? "This permanently removes this chapter and its drafted content from your project. This cannot be undone."
                            : `This will cancel the collaboration with ${partnerName}. The workspace content will be preserved but editing will be locked.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {isChapter ? "Keep Chapter" : "Keep Collab"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            try {
                              if (isChapter) {
                                const { error } = await supabase
                                  .from("collab_requests")
                                  .delete()
                                  .eq("id", request.id);
                                if (error) throw error;
                                toast.success("Chapter deleted");
                                navigate(
                                  request.project_id
                                    ? `/dashboard/projects/${request.project_id}`
                                    : "/dashboard/projects",
                                );
                              } else {
                                const { error } = await supabase
                                  .from("collab_requests")
                                  .update({ status: "cancelled" })
                                  .eq("id", request.id);
                                if (error) throw error;
                                toast.success("Collaboration cancelled");
                                supabase.functions
                                  .invoke("send-collab-email", {
                                    body: { type: "collab_cancelled", requestId: request.id },
                                  })
                                  .catch((err) => console.error("Failed to send cancellation email:", err));
                                navigate("/dashboard/collaborations");
                              }
                            } catch (err) {
                              console.error("Error on destructive action:", err);
                              toast.error(
                                isChapter ? "Failed to delete chapter" : "Failed to cancel collaboration",
                              );
                            }
                          }}
                        >
                          {isChapter ? "Delete Chapter" : "Cancel Collab"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                );
              })()}
            </div>

            {/* Writer's Room — Collaborators */}
            {(isCreator || collaborators.length > 0) && (
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Writer's Room
                  </h4>
                  {isCreator && request.status === "approved" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowInviteModal(true)}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Invite
                    </Button>
                  )}
                </div>

                {/* Participants list */}
                <TooltipProvider delayDuration={300}>
                  <div className="space-y-2">
                    {/* Owner */}
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar className="w-6 h-6">
                        {creatorInfo?.profile_image_url && (
                          <AvatarImage
                            src={sanitizeSubstackImageUrl(creatorInfo.profile_image_url)}
                            alt={creatorInfo?.name || "Owner"}
                          />
                        )}
                        <AvatarFallback className="text-[10px] font-bold gradient-primary text-primary-foreground">
                          {(creatorInfo?.name || "C").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{creatorInfo?.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Owner</span>
                      {isCreator && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                      )}
                    </div>
                    {/* Original requester — hide for solo workspaces (same person as owner) */}
                    {!isSolo && (
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar className="w-6 h-6">
                          {request.requester_profile_image_url && (
                            <AvatarImage
                              src={sanitizeSubstackImageUrl(request.requester_profile_image_url)}
                              alt={request.requester_name}
                            />
                          )}
                          <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
                            {(request.requester_name || "G").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{request.requester_name}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Guest</span>
                      </div>
                    )}
                    {/* Invited collaborators */}
                    {visibleCollaborators.map((c) => {
                      const isMe = !!c.user_id && c.user_id === user?.id;
                      const displayName = c.display_name;
                      const tooltipText = c.user_id
                        ? c.username
                          ? `@${c.username}`
                          : displayName
                        : isCreator
                          ? c.email
                          : "Pending invite";

                      return (
                        <Tooltip key={c.id}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 text-sm cursor-default group">
                              <Avatar className="w-6 h-6">
                                {c.profile_image_url && (
                                  <AvatarImage src={sanitizeSubstackImageUrl(c.profile_image_url)} alt={displayName} />
                                )}
                                <AvatarFallback className="text-[10px] font-bold bg-accent/30 text-accent-foreground">
                                  {c.name ? (
                                    c.name.charAt(0).toUpperCase()
                                  ) : c.guest_number != null ? (
                                    `G${c.guest_number}`
                                  ) : (
                                    <User className="w-3 h-3" />
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-muted-foreground flex-1">{displayName}</span>
                              {isMe && (
                                <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                              )}
                              {c.joined_at ? (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  Joined
                                </span>
                              ) : (
                                <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                                  Pending
                                </span>
                              )}
                              {isCreator && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemovingCollaborator({ id: c.id, name: displayName });
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  aria-label={`Remove ${displayName}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">{tooltipText}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Remove collaborator confirmation dialog */}
                    <AlertDialog
                      open={!!removingCollaborator}
                      onOpenChange={(open) => !open && setRemovingCollaborator(null)}
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {removingCollaborator?.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately revoke their access to this workspace. They won't be able to view or
                            edit the draft.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              if (!removingCollaborator) return;
                              const name = removingCollaborator.name;
                              const { error } = await supabase
                                .from("workspace_collaborators")
                                .delete()
                                .eq("id", removingCollaborator.id);
                              setRemovingCollaborator(null);
                              if (error) {
                                toast.error("Failed to remove collaborator");
                              } else {
                                toast.success(`Access revoked for ${name}`);
                                trackEvent("collaborator_removed", { request_id: requestId });
                                refetchCollaborators();
                              }
                            }}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TooltipProvider>
              </div>
            )}

            {/* Active Editor Presence Banner */}
            {activeEditors.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning-foreground">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <span>
                  <strong>{activeEditors[0].user_name}</strong> is currently editing. Wait for them to save before
                  making changes.
                </span>
              </div>
            )}

            {/* Collab Impact Metrics (published collabs) */}
            {request.status === "published" && (
              <CollabImpactCard
                requestId={request.id}
                creatorName={creatorInfo?.name}
                requesterName={request.requester_name}
              />
            )}

            {/* Conversation Feed */}
            <div className="glass-card p-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Conversation</h4>
              <WorkspaceConversation
                requestId={request.id}
                currentUserIsCreator={isCreator}
                refreshKey={msgRefreshKey}
                participants={[
                  ...(creatorInfo?.name
                    ? [{ email: (creatorInfo as any)?.email as string | undefined, display_name: creatorInfo.name }]
                    : []),
                  ...(!isSolo && request.requester_email
                    ? [{ email: request.requester_email, display_name: request.requester_name || "Guest" }]
                    : []),
                  ...visibleCollaborators.map((c) => ({ email: c.email, display_name: c.display_name })),
                ]}
              />
            </div>
          </motion.div>

          {/* Right Panel — Workspace */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="min-w-0"
          >
            <SharedWorkspace
              requestId={request.id}
              sharedContent={request.shared_content}
              lastEditedBy={request.content_last_edited_by}
              lastEditedAt={request.content_last_edited_at}
              currentUserName={currentUserName}
              canEdit={true}
              partnerName={partnerName || undefined}
              isCreator={isCreator}
              editingSessions={(request as any).editing_sessions || []}
              onShareClick={isCreator ? () => setShowInviteModal(true) : undefined}
              onContentSaved={(content, editedBy, editedAt) => {
                setRequest((prev) =>
                  prev
                    ? {
                        ...prev,
                        shared_content: content,
                        content_last_edited_by: editedBy,
                        content_last_edited_at: editedAt,
                      }
                    : prev,
                );
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      <InviteCollaboratorModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        requestId={request.id}
        isPro={isPro}
        credits={credits}
        onInvited={() => {
          refetchCollaborators();
          if (!isPro) setCredits((c) => Math.max(0, c - 1));
        }}
      />

      {isCreator && (
        <>
          <CollabDraftModal
            open={showDraftModal}
            onOpenChange={setShowDraftModal}
            draft={localDraft}
            requesterName={request.requester_name}
            requestId={request.id}
            isLoading={isGeneratingDraft}
            onRegenerate={generateDraft}
            onDelete={handleDeleteDraft}
            onApplied={(html) =>
              setRequest((prev) =>
                prev
                  ? {
                      ...prev,
                      shared_content: html,
                      content_last_edited_by: "SMART Draft",
                      content_last_edited_at: new Date().toISOString(),
                    }
                  : prev
              )
            }
          />
          <SendMessageModal
            open={showMessageModal}
            onOpenChange={setShowMessageModal}
            requestId={request.id}
            requesterName={messageRecipientName}
            requesterEmail={request.requester_email}
            creatorEmail={user?.email || ""}
            onMessageSent={handleMessageSent}
          />
        </>
      )}

      {isGuestView && (
        <GuestMessageModal
          open={showMessageModal}
          onOpenChange={setShowMessageModal}
          requestId={request.id}
          creatorName={creatorInfo?.name || "Creator"}
          // Prefer the auth user's email so invited collaborators (whose
          // request.requester_email is intentionally redacted by the
          // get_workspace_request RPC) can also send the first message.
          senderEmail={user?.email || request.requester_email || null}
          onMessageSent={handleMessageSent}
        />
      )}
      {request?.is_project_workspace && request?.project_id && isCreator && (
        <MoveChapterDialog
          chapterId={request.id}
          chapterTitle={request.message || "Untitled chapter"}
          currentProjectId={request.project_id}
          open={showMoveChapter}
          onOpenChange={setShowMoveChapter}
          onMoved={(targetProjectId) => {
            // Redirect out of the stale project URL to avoid 404 state.
            navigate(`/dashboard/projects/${targetProjectId}`);
          }}
        />
      )}
    </DashboardLayout>
  );
}
