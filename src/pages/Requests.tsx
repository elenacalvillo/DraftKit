import { useEffect, useState, useRef, useMemo } from "react";
import { parseDateString } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ArrowLeft, Compass } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RequestCard } from "@/components/requests/RequestCard";
import { CollabDraft } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { usePro } from "@/hooks/usePro";
import { useActiveCollabs } from "@/hooks/useActiveCollabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DbCollabRequest {
  id: string;
  creator_id: string;
  requester_name: string;
  requester_email: string;
  requester_substack_url: string | null;
  requester_profile_image_url: string | null;
  message: string | null;
  requested_date: string;
  status: string;
  created_at: string;
  ai_draft: unknown;
  approved_at: string | null;
  creator_notes: string | null;
  shared_content: string | null;
  content_last_edited_by: string | null;
  content_last_edited_at: string | null;
}

type FilterTab = "all" | "pending" | "approved" | "declined" | "cancelled" | "published";

export default function Requests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, creator, loading } = useAuth();
  const { trackEvent } = useAnalytics();
  const { isPro } = usePro();
  const { activeCount, canApprove, refetch: refetchActiveCollabs } = useActiveCollabs();
  const [requests, setRequests] = useState<DbCollabRequest[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab | null>(null);
  const [tabInitialized, setTabInitialized] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle URL params: ?tab= and ?highlight=
  const highlightParam = searchParams.get('highlight');
  const tabParam = searchParams.get('tab') as FilterTab | null;

  // Determine initial tab once data loads — no flicker
  useEffect(() => {
    if (tabInitialized || requests.length === 0) return;

    // If URL has ?highlight=, force "all" tab
    if (highlightParam) {
      setActiveTab("all");
    } else if (tabParam && ["all", "pending", "approved", "declined", "cancelled", "published"].includes(tabParam)) {
      setActiveTab(tabParam);
    } else {
      // Smart default: pending → approved → all
      const pendingCount = requests.filter(r => r.status === "pending").length;
      const approvedCount = requests.filter(r => r.status === "approved").length;
      if (pendingCount > 0) {
        setActiveTab("pending");
      } else if (approvedCount > 0) {
        setActiveTab("approved");
      } else {
        setActiveTab("all");
      }
    }
    setTabInitialized(true);
  }, [requests, tabInitialized, highlightParam, tabParam]);

  useEffect(() => {
    if (highlightParam && requests.length > 0 && tabInitialized) {
      const requestExists = requests.some(r => r.id === highlightParam);
      
      if (requestExists) {
        if (activeTab !== "all") {
          setActiveTab("all");
        }
        setHighlightedId(highlightParam);
        
        setTimeout(() => {
          const element = document.getElementById(`request-${highlightParam}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
        
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedId(null);
          setSearchParams({});
        }, 3000);
      } else {
        setSearchParams({});
      }
    }

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [highlightParam, requests, setSearchParams, activeTab, tabInitialized]);

  useEffect(() => {
    if (creator) {
      fetchRequests();
    }
  }, [creator]);

  const fetchRequests = async () => {
    if (!creator) return;

    const { data } = await supabase
      .from('collab_requests')
      .select('*')
      .eq('creator_id', creator.id)
      .eq('hidden_by_creator', false)
      .order('created_at', { ascending: false });

    if (data) {
      // Batch-resolve missing profile images from creator profiles
      const missingImageUserIds = data
        .filter((r: any) => !r.requester_profile_image_url && r.requester_user_id)
        .map((r: any) => r.requester_user_id!);

      let imageMap: Record<string, string> = {};
      if (missingImageUserIds.length > 0) {
        const { data: creators } = await supabase
          .from('creators')
          .select('user_id, profile_image_url')
          .in('user_id', missingImageUserIds)
          .not('profile_image_url', 'is', null);
        if (creators) {
          imageMap = Object.fromEntries(creators.map(c => [c.user_id, c.profile_image_url!]));
        }
      }

      const resolvedReqs = data.map((r: any) => ({
        ...r,
        requester_profile_image_url: r.requester_profile_image_url 
          || (r.requester_user_id && imageMap[r.requester_user_id]) 
          || null,
      }));

      setRequests(resolvedReqs as DbCollabRequest[]);
    }
  };

  const handleApprove = async (id: string) => {
    if (!creator) return;

    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const { error } = await supabase
      .from('collab_requests')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      toast.error("Failed to approve request");
      return;
    }

    // Update availability - remove the date from available
    const { data: availData } = await supabase
      .from('availability')
      .select('*')
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (availData) {
      await supabase
        .from('availability')
        .update({
          available_dates: (availData.available_dates || []).filter(
            (d: string) => d !== request.requested_date
          ),
        })
        .eq('id', availData.id);
    }

    setRequests(
      requests.map((r) => (r.id === id ? { ...r, status: 'approved', approved_at: new Date().toISOString() } : r))
    );

    // Refresh active collab count
    refetchActiveCollabs();

    toast.success(`Collaboration with ${request.requester_name} approved!`, {
      description: "Click 'Generate Draft' to create a collaboration outline.",
    });

    // Track approval
    trackEvent("collab_approved", { request_id: id });

    // Send email notification (fire and forget)
    supabase.functions.invoke('send-collab-email', {
      body: { type: 'request_approved', requestId: id }
    }).catch(err => console.error('Failed to send approval email:', err));
  };

  const handleDecline = async (id: string) => {
    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const { error } = await supabase
      .from('collab_requests')
      .update({ status: 'declined' })
      .eq('id', id);

    if (error) {
      toast.error("Failed to decline request");
      return;
    }

    setRequests(
      requests.map((r) => (r.id === id ? { ...r, status: 'declined' } : r))
    );

    toast.info(`Request from ${request.requester_name} declined`);

    // Track decline
    trackEvent("collab_declined", { request_id: id });

    // Send email notification (fire and forget)
    supabase.functions.invoke('send-collab-email', {
      body: { type: 'request_declined', requestId: id }
    }).catch(err => console.error('Failed to send decline email:', err));
  };

  const handleCancel = async (id: string) => {
    if (!creator) return;

    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const { error } = await supabase
      .from('collab_requests')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      toast.error("Failed to cancel collaboration");
      return;
    }

    // Restore the date to available_dates
    if (request.requested_date) {
      const { data: availData } = await supabase
        .from('availability')
        .select('*')
        .eq('creator_id', creator.id)
        .maybeSingle();

      if (availData) {
        const currentAvailable = availData.available_dates || [];
        if (!currentAvailable.includes(request.requested_date)) {
          await supabase
            .from('availability')
            .update({
              available_dates: [...currentAvailable, request.requested_date],
            })
            .eq('id', availData.id);
        }
      }
    }

    setRequests(
      requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
    );

    toast.success(`Collaboration cancelled.${request.requested_date ? ' Date restored to available.' : ''}`);
    trackEvent("collab_cancelled", { request_id: id });

    // Notify the guest that the host cancelled their approved collab
    supabase.functions.invoke('send-collab-email', {
      body: { type: 'collab_cancelled_by_host', requestId: id }
    }).catch(err => console.error('Failed to send cancellation email:', err));
  };

  const handleDraftGenerated = (id: string, draft: CollabDraft) => {
    setRequests(
      requests.map((r) => (r.id === id ? { ...r, ai_draft: draft } : r))
    );
  };

  const handleReschedule = async (id: string, newDate: string) => {
    if (!creator) return;

    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const oldDate = request.requested_date;

    // 1. Update the request's date
    const { error } = await supabase
      .from('collab_requests')
      .update({ requested_date: newDate })
      .eq('id', id);

    if (error) {
      toast.error("Failed to reschedule");
      return;
    }

    // 2. Swap availability: restore old date, remove new date
    const { data: availData } = await supabase
      .from('availability')
      .select('*')
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (availData) {
      let dates: string[] = availData.available_dates || [];
      // Restore old date
      if (oldDate && !dates.includes(oldDate)) {
        dates = [...dates, oldDate];
      }
      // Remove new date
      dates = dates.filter((d: string) => d !== newDate);

      await supabase
        .from('availability')
        .update({ available_dates: dates })
        .eq('id', availData.id);
    }

    // 3. Update local state
    setRequests(
      requests.map((r) => (r.id === id ? { ...r, requested_date: newDate } : r))
    );

    const formattedNew = parseDateString(newDate).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    toast.success(`Rescheduled to ${formattedNew}. Old slot restored.`);
    trackEvent("collab_rescheduled", { request_id: id, new_date: newDate });

    // 4. Notify guest (fire and forget)
    supabase.functions.invoke('send-collab-email', {
      body: { type: 'collab_rescheduled', requestId: id, newDate }
    }).catch(err => console.error('Failed to send reschedule email:', err));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('collab_requests')
      .update({ hidden_by_creator: true })
      .eq('id', id);

    if (error) {
      toast.error("Failed to delete request");
      return;
    }

    setRequests(requests.filter(r => r.id !== id));
    toast.success("Request deleted");
  };

  const resolvedTab = activeTab || "all";

  const filteredRequests = requests
    .filter((r) => {
      if (resolvedTab === "all") return true;
      return r.status === resolvedTab;
    })
    .sort((a, b) => {
      if (resolvedTab === "approved") {
        if (!a.requested_date && !b.requested_date) return 0;
        if (!a.requested_date) return 1;
        if (!b.requested_date) return -1;
        return a.requested_date.localeCompare(b.requested_date);
      }
      if (resolvedTab === "published") {
        if (!a.requested_date && !b.requested_date) return 0;
        if (!a.requested_date) return 1;
        if (!b.requested_date) return -1;
        return b.requested_date.localeCompare(a.requested_date);
      }
      const aDate = a.requested_date;
      const bDate = b.requested_date;
      if (aDate && bDate) return aDate.localeCompare(bDate);
      if (aDate) return -1;
      if (bDate) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const tabs: { value: FilterTab; label: string; count: number }[] = [
    { value: "all", label: "All", count: requests.length },
    { value: "pending", label: "Pending", count: requests.filter((r) => r.status === "pending").length },
    { value: "approved", label: "Approved", count: requests.filter((r) => r.status === "approved").length },
    { value: "published", label: "✨ Published", count: requests.filter((r) => r.status === "published").length },
    { value: "declined", label: "Declined", count: requests.filter((r) => r.status === "declined").length },
    { value: "cancelled", label: "Cancelled", count: requests.filter((r) => r.status === "cancelled").length },
  ];

  if (!creator) return null;

  // Map requests to the format expected by RequestCard
  const mappedRequests = filteredRequests.map((r) => ({
    id: r.id,
    creatorUsername: creator.username,
    requesterName: r.requester_name,
    requesterEmail: r.requester_email,
    requesterSubstackUrl: r.requester_substack_url || '',
    requesterProfileImageUrl: r.requester_profile_image_url,
    message: r.message || '',
    requestedDate: r.requested_date,
    status: r.status as 'pending' | 'approved' | 'declined' | 'cancelled' | 'published',
    createdAt: r.created_at,
    aiDraft: r.ai_draft as CollabDraft | null,
    approvedAt: r.approved_at,
    // Workspace fields
    shared_content: r.shared_content,
    content_last_edited_by: r.content_last_edited_by,
    content_last_edited_at: r.content_last_edited_at,
    _currentUserName: creator.name,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">
              {resolvedTab === "pending" ? "Needs Your Response" : resolvedTab === "approved" ? "Upcoming Collaborations" : "Collaboration Requests"}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {resolvedTab === "pending" ? "Review and respond to incoming requests" : resolvedTab === "approved" ? "Collaborations coming up next" : "Review and manage incoming collaboration requests"}
          </p>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-8 p-1 glass-card w-fit"
        >
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              variant={resolvedTab === tab.value ? "gradient" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "relative",
                resolvedTab === tab.value && "shadow-none"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "ml-2 px-2 py-0.5 rounded-full text-xs",
                    resolvedTab === tab.value
                      ? "bg-primary-foreground/20"
                      : tab.value === "pending" && tab.count > 0
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </Button>
          ))}
        </motion.div>

        {/* Request cards */}
        <AnimatePresence mode="popLayout">
          {mappedRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-16 text-center"
            >
              <Inbox className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {resolvedTab === "pending" ? "You're all caught up!" : "No requests yet"}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {resolvedTab === "pending"
                  ? "No pending requests right now. Find your next collaborator!"
                  : "Share your public link to start receiving collaboration requests from other creators."}
              </p>
              {resolvedTab === "pending" ? (
                <Button
                  className="mt-6"
                  onClick={() => navigate("/dashboard/discovery")}
                >
                  <Compass className="w-4 h-4 mr-2" />
                  Explore Discovery
                </Button>
              ) : (
                <div className="mt-6 p-4 bg-muted/50 rounded-xl inline-block">
                  <code className="text-sm text-primary">
                    draftkit.app/{creator.username}
                  </code>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="grid gap-6">
              {mappedRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  id={`request-${request.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "transition-all duration-500",
                    highlightedId === request.id && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl shadow-glow"
                  )}
                >
                  <RequestCard
                    request={request}
                    creatorEmail={user?.email || ""}
                    canApprove={canApprove}
                    isPro={isPro}
                    bookedDates={requests
                      .filter(r => (r.status === 'approved' || r.status === 'published') && r.requested_date && r.id !== request.id)
                      .map(r => r.requested_date)}
                    onApprove={handleApprove}
                    onDecline={handleDecline}
                    onCancel={handleCancel}
                    onDraftGenerated={handleDraftGenerated}
                    onDelete={handleDelete}
                    onReschedule={handleReschedule}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
