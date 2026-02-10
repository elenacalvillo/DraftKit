import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ExternalLink, LinkIcon, Mail, Sparkles, FileText, MessageSquare, PenLine } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SharedWorkspace } from "@/components/requests/SharedWorkspace";
import { CollabDraftModal } from "@/components/requests/CollabDraftModal";
import { SendMessageModal } from "@/components/requests/SendMessageModal";
import { GuestMessageModal } from "@/components/requests/GuestMessageModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
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
  const { trackEvent } = useAnalytics();

  const [request, setRequest] = useState<WorkspaceRequest | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Role
  const isCreator = !!creator && creator.id === request?.creator_id;
  const isGuest = !!user && user.id === request?.requester_user_id;

  // Modals
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [localDraft, setLocalDraft] = useState<CollabDraft | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (user && requestId) {
      fetchRequest();
    }
  }, [user, authLoading, requestId]);

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
        toast.success("Collaboration draft generated!");
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

  if (request.status !== "approved") {
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

  return (
    <DashboardLayout zenMode zenTitle={`Workspace · ${partnerName}`} zenBackPath={backPath}>
      <div className="max-w-6xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => navigate(backPath)}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Requests</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
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
                <Calendar className="w-4 h-4" />
                <span>
                  {request.requested_date
                    ? formatDate(request.requested_date)
                    : "Flexible — To be scheduled"}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="truncate">{request.requester_email}</span>
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
                  {localDraft ? "View AI Draft" : "Generate AI Draft"}
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
          </motion.div>

          {/* Right Panel — Workspace */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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
        />
      )}
    </DashboardLayout>
  );
}
