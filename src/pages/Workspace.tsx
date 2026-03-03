import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar as CalendarIcon, CalendarDays, ExternalLink, LinkIcon, Mail, Sparkles, FileText, MessageSquare, PenLine, Lock, X, PartyPopper, CheckCircle2, Copy, Check, Crown, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
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
import { useCreatorPro } from "@/hooks/useCreatorPro";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { CollabDraft } from "@/lib/storage";
import { parseDateString, cn } from "@/lib/utils";
import { extractSubstackUsername, normalizeSubstackUrl } from "@/lib/substack-url";
import { toast } from "sonner";

interface WorkspaceRequest {
  id: string;
  creator_id: string;
  requester_name: string;
  requester_email: string;
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
  const { user, creator, loading: authLoading } = useAuth();
  const { isPro } = usePro(); // Current user's own Pro status (for creator-only features)
  const { trackEvent } = useAnalytics();

  const [request, setRequest] = useState<WorkspaceRequest | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Role
  const isCreator = !!creator && creator.id === request?.creator_id;
  const isGuest = !!user && user.id === request?.requester_user_id;

  // Host-pays model: workspace access is determined by the HOST creator's Pro status,
  // not the current visitor's. Guests inherit the host's tier.
  const { isPro: isHostPro, isLoading: isHostProLoading } = useCreatorPro(request?.creator_id);
  const { isAdmin } = useAdmin();
  // Admins bypass all paywalls
  const effectiveCanEdit = isAdmin || isHostPro;

  // Modals
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [localDraft, setLocalDraft] = useState<CollabDraft | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [msgRefreshKey, setMsgRefreshKey] = useState(0);
  const [retroDismissed, setRetroDismissed] = useState(() =>
    localStorage.getItem(`retro-dismissed-${requestId}`) === "true"
  );
  const [publishAnswer, setPublishAnswer] = useState<string | null>(null);
  // undefined = loading, null = not answered, {message} = already answered
  const [existingRetroFeedback, setExistingRetroFeedback] = useState<{ message: string } | null | undefined>(undefined);

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

  const fetchRequest = async () => {
    try {
      const { data, error } = await supabase
        .from("collab_requests")
        .select("*")
        .eq("id", requestId!)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRequest(data as WorkspaceRequest);
      setLocalDraft((data.ai_draft as unknown as CollabDraft) || null);

      // Fetch creator info
      const { data: cInfo } = await supabase
        .from("public_creator_profiles")
        .select("id, name, username, profile_image_url, substack_url")
        .eq("id", data.creator_id)
        .maybeSingle();

      setCreatorInfo(cInfo as CreatorInfo | null);
    } catch (err) {
      console.error("Error fetching workspace request:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const generateDraft = async () => {
    setIsGeneratingDraft(true);
    setShowDraftModal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        // Only update shared_content if no human content was preserved
        if (data.shared_content && !data.human_content_preserved) {
          setRequest((prev) =>
            prev
              ? {
                  ...prev,
                  shared_content: data.shared_content,
                  content_last_edited_by: "SMART Draft",
                  content_last_edited_at: new Date().toISOString(),
                }
              : prev
          );
        }
        // Set first_draft_generated_at if not already set
        if (!(request as any).first_draft_generated_at) {
          await supabase
            .from("collab_requests")
            .update({ first_draft_generated_at: new Date().toISOString() } as any)
            .eq("id", request!.id);
          setRequest((prev) => prev ? { ...prev, first_draft_generated_at: new Date().toISOString() } as any : prev);
        }
        const msg = data.human_content_preserved
          ? "SMART draft saved! Your manual work is untouched — view it in the SMART Draft panel."
          : "Collaboration draft generated!";
        toast.success(msg);
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
      const { error } = await supabase
        .from("collab_requests")
        .update({ ai_draft: null })
        .eq("id", request!.id);
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
    const { error } = await supabase
      .from('collab_requests')
      .update({ requested_date: newDate })
      .eq('id', request.id);
    if (error) {
      toast.error("Failed to reschedule");
      return;
    }
    const { data: availData } = await supabase
      .from('availability')
      .select('*')
      .eq('creator_id', creator.id)
      .maybeSingle();
    if (availData) {
      let dates: string[] = availData.available_dates || [];
      if (oldDate && !dates.includes(oldDate)) dates = [...dates, oldDate];
      dates = dates.filter((d: string) => d !== newDate);
      await supabase
        .from('availability')
        .update({ available_dates: dates })
        .eq('id', availData.id);
    }
    setRequest(prev => prev ? { ...prev, requested_date: newDate } : prev);
    setShowReschedulePicker(false);
    const formattedNew = parseDateString(newDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    toast.success(`Rescheduled to ${formattedNew}. Old slot restored.`);
    trackEvent("collab_rescheduled", { request_id: request.id, new_date: newDate });
    supabase.functions.invoke('send-collab-email', {
      body: { type: 'collab_rescheduled', requestId: request.id, newDate }
    }).catch(err => console.error('Failed to send reschedule email:', err));
  };

  const currentUserName = isCreator
    ? creator!.name
    : request?.requester_name || "Guest";

  const backPath = isCreator ? "/dashboard/requests" : "/dashboard/my-requests";

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

  // The partner — the "other person" in the collab
  const partnerName = isCreator
    ? request?.requester_name
    : creatorInfo?.name || "Creator";
  const partnerSubstackUrl = isCreator
    ? request?.requester_substack_url
    : creatorInfo?.substack_url;
  const partnerProfileImage = isCreator
    ? request?.requester_profile_image_url
    : creatorInfo?.profile_image_url;

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
          <p className="text-muted-foreground mb-6">
            This collaboration request doesn't exist or you don't have access.
          </p>
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
          <p className="text-muted-foreground mb-6">
            The workspace is only available for approved collaborations.
          </p>
          <Button variant="outline" onClick={() => navigate(backPath)}>
            Back to Requests
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // --- PRO GATE ---
  // Wait for host Pro status to resolve before gating (prevents flash of wrong content).
  if (!loading && !authLoading && isHostProLoading) {
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

  // Hard gate: creator (host) is free tier — show upgrade wall
  if (isCreator && !effectiveCanEdit) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-20 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card p-10 flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <Crown className="w-10 h-10 text-primary-foreground" />
            </div>

            <div className="space-y-3 max-w-md">
              <h2 className="text-2xl font-bold">The Shared Workspace is a Pro Feature</h2>
              <p className="text-muted-foreground leading-relaxed">
                Unlock async drafting, real-time conversation history, and a beautiful co-writing
                environment — built to turn collab ideas into published posts, fast.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={() => navigate("/dashboard/subscription")}
              >
                <Crown className="w-5 h-5" />
                Unlock the Workspace &amp; Start Shipping
              </Button>
            </div>

            <button
              onClick={() => navigate(backPath)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Requests
            </button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  // Hard gate: guest of a free-tier host — neutral waiting screen (no billing CTA)
  if (isGuest && !isHostPro && !isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-20 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card p-10 flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
              <Clock className="w-10 h-10 text-muted-foreground" />
            </div>

            <div className="space-y-3 max-w-md">
              <h2 className="text-2xl font-bold">Workspace Coming Soon</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your collaboration partner hasn't unlocked the workspace yet. Once they do,
                you'll both have access to the shared drafting space and conversation history.
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowMessageModal(true)}
            >
              <MessageSquare className="w-5 h-5" />
              Message {partnerName?.split(" ")[0] || "Partner"}
            </Button>

            <button
              onClick={() => navigate(backPath)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to My Requests
            </button>
          </motion.div>
        </div>

        {isGuest && (
          <GuestMessageModal
            open={showMessageModal}
            onOpenChange={setShowMessageModal}
            requestId={request.id}
            creatorName={creatorInfo?.name || "Creator"}
            requesterEmail={request.requester_email}
            onMessageSent={handleMessageSent}
          />
        )}
      </DashboardLayout>
    );
  }

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
  const handlePublishAnswer = async (answer: "yes" | "not_yet") => {
    setPublishAnswer(answer);

    // Step 1 (CRITICAL): Flip the status to 'published' FIRST, independently of feedback logging
    // Use user?.id instead of isCreator to avoid the async race condition where creator
    // hasn't loaded yet — RLS on the server enforces that only the actual creator can update.
    if (answer === "yes" && requestId && user?.id) {
      const { error: publishError } = await supabase
        .from("collab_requests")
        .update({ status: "published" })
        .eq("id", requestId);

      if (publishError) {
        console.error("[Workspace] Failed to update status to published:", publishError);
        toast.error("Couldn't mark as published — please try again.");
        setPublishAnswer(null);
        return;
      }

      setRequest(prev => prev ? { ...prev, status: "published" } : prev);

      // Notify the guest partner — non-fatal
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.functions.invoke("send-collab-email", {
            body: { type: "collab_published", requestId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send collab_published email:", emailErr);
      }
    }

    // Step 2: Log feedback separately — failure here must NOT block the status update above
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

    toast.success(answer === "yes" ? "Congrats on publishing! 🎉" : "No rush — we'll be here when it's ready!");
  };

  const dismissRetro = () => {
    setRetroDismissed(true);
    localStorage.setItem(retroDismissKey, "true");
  };

  return (
    <DashboardLayout zenMode zenTitle={`Drafting with ${partnerName}`} zenBackPath={backPath}>
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
                existingRetroFeedback ? "border-l-success" : "border-l-primary"
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
                    {publishAnswer === "yes" && request.status !== "published" && (
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
                            setRequest(prev => prev ? { ...prev, status: "published" } : prev);
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

                  <div className="flex flex-wrap items-center gap-3">
                    {existingRetroFeedback === null && (
                      <>
                        <span className="text-sm font-medium">Was this published?</span>
                        {publishAnswer ? (
                          <Badge variant="secondary">
                            {publishAnswer === "yes" ? "✅ Yes" : "⏳ Not yet"}
                          </Badge>
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
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left Panel — Context Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Partner Card */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                {partnerProfileImage ? (
                  <img
                    src={partnerProfileImage}
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

              <Badge variant="secondary" className="capitalize">
                {request.selected_collab_type || "Collaboration"}
              </Badge>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {request.requested_date
                    ? formatDate(request.requested_date)
                    : "Flexible — To be scheduled"}
                </span>
                {isCreator && request.status === "approved" && (() => {
                  if (!request.requested_date) return true;
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const rd = parseDateString(request.requested_date); rd.setHours(0, 0, 0, 0);
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
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        handleReschedule(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    className="p-3 pointer-events-auto mx-auto"
                  />
                </DialogContent>
              </Dialog>

              {/* Email */}
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
                    navigator.clipboard.writeText(request.requester_email);
                    toast.success("Email copied!");
                  }}
                  title="Copy email address"
                  className="ml-1 p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Message */}
            {request.message && (
              <div className="glass-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Original Message</p>
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  "{request.message}"
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {isCreator && (
                <Button
                  variant={localDraft ? "outline" : "gradient"}
                  size="sm"
                  onClick={handleViewDraft}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {localDraft ? "View SMART Draft" : "Generate SMART Draft"}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMessageModal(true)}
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Message {partnerName?.split(" ")[0] || "Partner"}
              </Button>

              {request.collab_link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(request.collab_link!, "_blank")}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open External Document
                </Button>
              )}
            </div>

            {/* Conversation Feed */}
            <div className="glass-card p-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Conversation
              </h4>
              {effectiveCanEdit ? (
                <WorkspaceConversation
                  requestId={request.id}
                  currentUserIsCreator={isCreator}
                  refreshKey={msgRefreshKey}
                />
              ) : isGuest ? (
                // Guests never see billing walls — the host needs to upgrade
                <p className="text-xs text-muted-foreground text-center py-4">
                  Conversation will be available once the workspace is unlocked.
                </p>
              ) : (
                // Creator (host) sees the upgrade prompt
                <div className="relative">
                  <div className="opacity-20 pointer-events-none blur-[2px]">
                    <div className="space-y-3">
                      <div className="rounded-lg bg-muted px-3 py-2 text-xs">Sample message…</div>
                      <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs">Reply message…</div>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UpgradePrompt feature="workspace" variant="card" />
                  </div>
                </div>
              )}
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
              canEdit={effectiveCanEdit}
              partnerName={partnerName || undefined}
              isCreator={isCreator}
              editingSessions={(request as any).editing_sessions || []}
              onContentSaved={(content, editedBy, editedAt) => {
                setRequest((prev) =>
                  prev
                    ? {
                        ...prev,
                        shared_content: content,
                        content_last_edited_by: editedBy,
                        content_last_edited_at: editedAt,
                      }
                    : prev
                );
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Modals */}
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
          />
          <SendMessageModal
            open={showMessageModal}
            onOpenChange={setShowMessageModal}
            requestId={request.id}
            requesterName={request.requester_name}
            requesterEmail={request.requester_email}
            creatorEmail={user?.email || ""}
            onMessageSent={handleMessageSent}
          />
        </>
      )}

      {isGuest && (
        <GuestMessageModal
          open={showMessageModal}
          onOpenChange={setShowMessageModal}
          requestId={request.id}
          creatorName={creatorInfo?.name || "Creator"}
          requesterEmail={request.requester_email}
          onMessageSent={handleMessageSent}
        />
      )}
    </DashboardLayout>
  );
}
