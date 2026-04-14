import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { parseDateString, sanitizeSubstackImageUrl } from "@/lib/utils";
import { Copy, ExternalLink, Globe, MessageSquare, PenLine, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { useAuth } from "@/hooks/useAuth";
import { usePro } from "@/hooks/usePro";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";

interface CollabRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_profile_image_url: string | null;
  requester_substack_url: string | null;
  requested_date: string;
  status: string;
  created_at: string;
  ai_draft: Json | null;
}

interface BookingInfo {
  date: string;
  requesterName: string;
  requesterProfileImageUrl: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, creator, loading } = useAuth();
  const { isPro, canHostMore } = usePro();
  const [availability, setAvailability] = useState<string[]>([]);
  const [requests, setRequests] = useState<CollabRequest[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [bookingDetails, setBookingDetails] = useState<BookingInfo[]>([]);
  const [publishedDates, setPublishedDates] = useState<string[]>([]);
  const [publishedBookingDetails, setPublishedBookingDetails] = useState<BookingInfo[]>([]);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [showStartWriting, setShowStartWriting] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [isCreatingSolo, setIsCreatingSolo] = useState(false);

  const handleImageError = useCallback((requestId: string) => {
    setImageErrors(prev => new Set(prev).add(requestId));
  }, []);

  // Deep-link router: Handle ?open=requests&highlight=... from email CTAs
  // This works around server-side routing that may redirect /dashboard/requests -> /dashboard
  useEffect(() => {
    if (loading) return;
    
    const openTarget = searchParams.get("open");
    const highlightId = searchParams.get("highlight");
    
    if (openTarget === "requests") {
      // Build the target URL with highlight param if present
      const targetUrl = highlightId 
        ? `/dashboard/requests?highlight=${encodeURIComponent(highlightId)}`
        : "/dashboard/requests";
      
      // Use replace to avoid back-button confusion
      navigate(targetUrl, { replace: true });
      return;
    }
  }, [loading, searchParams, navigate]);

  useEffect(() => {
    if (creator) {
      fetchData();
    }
  }, [creator]);

  const fetchData = async () => {
    if (!creator) return;

    // Fetch availability
    const { data: availData } = await supabase
      .from('availability')
      .select('*')
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (availData) {
      setAvailability(availData.available_dates || []);
    }

    // Fetch requests
    const { data: reqData } = await supabase
      .from('collab_requests')
      .select('id, requester_name, requester_email, requester_profile_image_url, requester_substack_url, requester_user_id, requested_date, status, created_at, ai_draft')
      .eq('creator_id', creator.id)
      .eq('hidden_by_creator', false)
      .order('created_at', { ascending: false });

    if (reqData) {
      // Batch-resolve missing profile images from creator profiles
      const missingImageUserIds = reqData
        .filter(r => !r.requester_profile_image_url && r.requester_user_id)
        .map(r => r.requester_user_id!);

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

      const resolvedReqs = reqData.map(r => ({
        ...r,
        requester_profile_image_url: r.requester_profile_image_url 
          || (r.requester_user_id && imageMap[r.requester_user_id]) 
          || null,
      }));

      setRequests(resolvedReqs);

      const approvedRequests = reqData.filter((r) => r.status === "approved" && r.requested_date);
      const publishedRequests = reqData.filter((r) => r.status === "published" && r.requested_date);

      setBookedDates(approvedRequests.map((r) => r.requested_date));
      setBookingDetails(
        approvedRequests.map((r) => ({
          date: r.requested_date,
          requesterName: r.requester_name,
          requesterProfileImageUrl: r.requester_profile_image_url,
          requestId: r.id,
        }))
      );

      setPublishedDates(publishedRequests.map((r) => r.requested_date));
      setPublishedBookingDetails(
        publishedRequests.map((r) => ({
          date: r.requested_date,
          requesterName: r.requester_name,
          requesterProfileImageUrl: r.requester_profile_image_url,
          requestId: r.id,
        }))
      );
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // Ship Rate: published / (non-pending, non-cancelled)
  const eligibleRequests = requests.filter((r) => r.status !== "pending" && r.status !== "cancelled");
  const publishedRequests = requests.filter((r) => r.status === "published");
  const shipRate = eligibleRequests.length > 0
    ? Math.round((publishedRequests.length / eligibleRequests.length) * 100)
    : null;
  const shipRateDisplay = shipRate === null ? "—" : `${shipRate}%`;

  // Published Collabs: unique requester_substack_url from published requests
  const uniquePublishedUrls = new Set(
    requests
      .filter((r) => r.status === "published" && r.requester_substack_url)
      .map((r) => r.requester_substack_url!.trim().toLowerCase())
  );
  const publishedReach = uniquePublishedUrls.size;
  const reachDisplay = `${publishedReach} ${publishedReach === 1 ? "Collab" : "Collabs"}`;

  // Time Saved: published collabs × (manual baseline − DraftKit efficiency)
  const MANUAL_TAX_HOURS = 8.5;
  const DRAFTKIT_EFFICIENCY_HOURS = 1.0;
  const publishedCount = publishedRequests.length;
  const hoursSaved = publishedCount * (MANUAL_TAX_HOURS - DRAFTKIT_EFFICIENCY_HOURS);
  const timeSavedDisplay = hoursSaved % 1 === 0 ? `${hoursSaved} hrs` : `${hoursSaved.toFixed(1)} hrs`;

  const stats = [
    {
      icon: TrendingUp,
      label: "Ship Rate",
      subLabel: "Requests turned into published work",
      value: shipRateDisplay,
      isEmpty: shipRate === null || shipRate === 0,
      emptyTip: "Approve and publish your first collab to track your closing rate",
      iconClassName: "text-primary",
      bgClassName: "bg-primary/10",
      iconStyle: undefined as React.CSSProperties | undefined,
      bgStyle: undefined as React.CSSProperties | undefined,
    },
    {
      icon: Globe,
      label: "Published Collabs",
      subLabel: "Unique audiences you've shipped with",
      value: reachDisplay,
      isEmpty: publishedReach === 0,
      emptyTip: "Publish your first collab to start tracking your reach",
      iconClassName: "",
      bgClassName: "",
      iconStyle: { color: "#c17f5c" } as React.CSSProperties,
      bgStyle: { backgroundColor: "#c17f5c1a" } as React.CSSProperties,
    },
    {
      icon: Zap,
      label: "Time Saved",
      subLabel: "vs. manual coordination baseline",
      value: timeSavedDisplay,
      isEmpty: publishedCount === 0,
      emptyTip: "Publish your first collab to start tracking time saved vs. manual coordination",
      iconClassName: "",
      bgClassName: "",
      iconStyle: { color: "#2a2318" } as React.CSSProperties,
      bgStyle: { backgroundColor: "#2a231810" } as React.CSSProperties,
    },
  ];

  if (!creator) return null;

  const handleCreateSoloWorkspace = async () => {
    if (!user || !creator) return;
    if (!projectTitle.trim()) {
      toast.error("Please enter a project title");
      return;
    }
    // Credit check for non-Pro
    if (!isPro && !canHostMore) {
      toast.error("You've used all your collaboration slots", {
        description: "Invite friends or upgrade to Pro for unlimited workspaces.",
        action: { label: "Upgrade", onClick: () => navigate("/dashboard/subscription") },
      });
      return;
    }

    setIsCreatingSolo(true);
    try {
      // Get the user's email
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const email = authUser?.email || "";

      const { data, error } = await supabase
        .from("collab_requests")
        .insert({
          creator_id: creator.id,
          requester_name: creator.name,
          requester_email: email,
          requester_user_id: user.id,
          requester_profile_image_url: creator.profile_image_url,
          requester_substack_url: creator.substack_url,
          status: "approved",
          approved_at: new Date().toISOString(),
          message: projectTitle.trim(),
          is_solo: true,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Deduct credit for non-Pro users
      if (!isPro) {
        await supabase
          .from("creators")
          .update({ credits: Math.max(0, (creator.credits ?? 3) - 1) })
          .eq("id", creator.id);
      }

      toast.success("Workspace created!");
      setShowStartWriting(false);
      setProjectTitle("");
      navigate(`/dashboard/workspace/${data.id}`);
    } catch (err) {
      console.error("Failed to create solo workspace:", err);
      toast.error("Failed to create workspace. Please try again.");
    } finally {
      setIsCreatingSolo(false);
    }
  };

  // Mode-aware calendar section (must be after creator null-check)
  const calendarHeader = creator.collab_mode === 'discovery' 
    ? "Your Availability" 
    : "Your Publication Schedule";

  const emptyStateText = creator.collab_mode === 'discovery'
    ? "No call slots set. Click 'Edit Availability' to mark when you're free — guests will book intro calls on these dates."
    : "No publishing windows set. Click 'Edit Availability' to set dates when you can ship — guests will pick from these as target publish dates.";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, <span className="gradient-text">{creator.name}</span>
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your collaborations
          </p>
        </motion.div>

        {/* Share Your Link Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                Your Public Booking Link
              </h3>
              <p className="text-sm text-muted-foreground">
                Share this with potential collaborators to let them book time with you
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-muted rounded-lg font-mono text-sm truncate max-w-[200px] sm:max-w-none">
                {window.location.origin}/{creator.username}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${creator.username}`);
                  toast.success("Link copied to clipboard!");
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button asChild size="icon">
                <a href={`/${creator.username}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6 hover-lift"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgClassName}`}
                  style={stat.bgStyle}
                >
                  <stat.icon
                    className={`w-6 h-6 ${stat.iconClassName}`}
                    style={stat.iconStyle}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm font-medium text-foreground">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.subLabel}</p>
                </div>
              </div>
              {stat.isEmpty && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                  {stat.emptyTip}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{calendarHeader}</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard/availability')}
              >
                {creator.collab_mode === 'discovery' ? 'Edit Availability' : 'Edit Publishing Dates'}
              </Button>
            </div>
            <CollabCalendar
              availableDates={availability}
              bookedDates={bookedDates}
              bookingDetails={bookingDetails}
              publishedDates={publishedDates}
              publishedBookingDetails={publishedBookingDetails}
              collabMode={creator.collab_mode as 'async' | 'discovery' | null}
              onBookedDateClick={(requestId) => navigate(`/dashboard/workspace/${requestId}`)}
            />
            {availability.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-4 rounded-lg bg-accent/10 border border-accent/20"
              >
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {creator.collab_mode === 'discovery' ? 'No availability set yet.' : 'No publishing dates set.'}
                  </span>{" "}
                  {emptyStateText.split('. ').slice(1).join('. ')}
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Recent requests */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {pendingCount > 0 ? "Action Required" : "Recent Collabs"}
              </h2>
              {pendingCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium">
                  {pendingCount} new
                </span>
              )}
            </div>

            <div className="glass-card p-4 space-y-4">
              {requests.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                   <p className="text-muted-foreground">No collabs yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Share your link to start receiving proposals
                  </p>
                </div>
              ) : (
                [...requests]
                  .sort((a, b) => {
                    const priority = (s: string) => s === 'pending' ? 0 : s === 'approved' ? 1 : 2;
                    const pa = priority(a.status);
                    const pb = priority(b.status);
                    if (pa !== pb) return pa - pb;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  })
                  .slice(0, 5)
                  .map((request) => {
                    const targetTab = request.status === 'pending' ? 'pending' : request.status === 'approved' ? 'approved' : '';
                    const targetUrl = targetTab ? `/dashboard/requests?tab=${targetTab}` : '/dashboard/requests';
                    return (
                      <motion.div
                        key={request.id}
                        whileHover={{ x: 4 }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(targetUrl)}
                      >
                        {request.requester_profile_image_url && !imageErrors.has(request.id) ? (
                          <img 
                            src={sanitizeSubstackImageUrl(request.requester_profile_image_url)} 
                            alt={request.requester_name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={() => handleImageError(request.id)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                            {request.requester_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{request.requester_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {parseDateString(request.requested_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs capitalize ${
                            request.status === "pending"
                              ? "bg-accent/10 text-accent"
                              : request.status === "approved"
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {request.status}
                        </span>
                      </motion.div>
                    );
                  })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
