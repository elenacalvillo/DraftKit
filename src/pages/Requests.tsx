import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ArrowLeft } from "lucide-react";
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
}

type FilterTab = "all" | "pending" | "approved" | "declined" | "cancelled";

export default function Requests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, creator, loading } = useAuth();
  const { trackEvent } = useAnalytics();
  const { isPro } = usePro();
  const { activeCount, canApprove, refetch: refetchActiveCollabs } = useActiveCollabs();
  const [requests, setRequests] = useState<DbCollabRequest[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle highlight query parameter
  const highlightParam = searchParams.get('highlight');

  useEffect(() => {
    if (highlightParam && requests.length > 0) {
      // Find if the request exists in ALL requests (not just filtered)
      const requestExists = requests.some(r => r.id === highlightParam);
      
      if (requestExists) {
        // Force "all" tab so the highlighted request is visible regardless of current filter
        if (activeTab !== "all") {
          setActiveTab("all");
        }
        
        // Set highlighted state
        setHighlightedId(highlightParam);
        
        // Scroll to the element after a brief delay to ensure it's rendered
        setTimeout(() => {
          const element = document.getElementById(`request-${highlightParam}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
        
        // Clear highlight after 3 seconds
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedId(null);
          // Clear the URL parameter
          setSearchParams({});
        }, 3000);
      } else {
        // Request not found, clear the param
        setSearchParams({});
      }
    }

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [highlightParam, requests, setSearchParams, activeTab]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (!loading && user && !creator) {
      navigate("/signup");
      return;
    }

    if (creator) {
      fetchRequests();
    }
  }, [user, creator, loading, navigate]);

  const fetchRequests = async () => {
    if (!creator) return;

    const { data } = await supabase
      .from('collab_requests')
      .select('*')
      .eq('creator_id', creator.id)
      .eq('hidden_by_creator', false)
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(data as DbCollabRequest[]);
    }
  };

  const handleApprove = async (id: string) => {
    if (!creator) return;

    // Free tier limit: only 1 active collaboration
    if (!isPro && !canApprove) {
      toast.error("Free tier is limited to 1 active collaboration", {
        description: "Upgrade to Pro for unlimited collaborations",
        action: {
          label: "Go Pro",
          onClick: () => navigate("/dashboard/settings?upgrade=true"),
        },
      });
      return;
    }

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

  const filteredRequests = requests.filter((r) => {
    if (activeTab === "all") return true;
    return r.status === activeTab;
  });

  const tabs: { value: FilterTab; label: string; count: number }[] = [
    { value: "all", label: "All", count: requests.length },
    { value: "pending", label: "Pending", count: requests.filter((r) => r.status === "pending").length },
    { value: "approved", label: "Approved", count: requests.filter((r) => r.status === "approved").length },
    { value: "declined", label: "Declined", count: requests.filter((r) => r.status === "declined").length },
    { value: "cancelled", label: "Cancelled", count: requests.filter((r) => r.status === "cancelled").length },
  ];

  if (loading || !creator) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

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
    status: r.status as 'pending' | 'approved' | 'declined' | 'cancelled',
    createdAt: r.created_at,
    aiDraft: r.ai_draft as CollabDraft | null,
    approvedAt: r.approved_at,
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
            <span className="gradient-text">Collaboration Requests</span>
          </h1>
          <p className="text-muted-foreground">
            Review and manage incoming collaboration requests
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
              variant={activeTab === tab.value ? "gradient" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "relative",
                activeTab === tab.value && "shadow-none"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "ml-2 px-2 py-0.5 rounded-full text-xs",
                    activeTab === tab.value
                      ? "bg-primary-foreground/20"
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
              <h3 className="text-xl font-semibold mb-2">No requests yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Share your public link to start receiving collaboration requests from other creators.
              </p>
              <div className="mt-6 p-4 bg-muted/50 rounded-xl inline-block">
                <code className="text-sm text-primary">
                  draftkit.app/{creator.username}
                </code>
              </div>
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
                    onApprove={handleApprove}
                    onDecline={handleDecline}
                    onCancel={handleCancel}
                    onDraftGenerated={handleDraftGenerated}
                    onDelete={handleDelete}
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
