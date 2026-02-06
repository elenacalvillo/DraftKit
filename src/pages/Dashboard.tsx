import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { parseDateString } from "@/lib/utils";
import { Calendar, Clock, Copy, ExternalLink, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";

interface CollabRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_profile_image_url: string | null;
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
  const [availability, setAvailability] = useState<string[]>([]);
  const [requests, setRequests] = useState<CollabRequest[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [bookingDetails, setBookingDetails] = useState<BookingInfo[]>([]);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

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
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (!loading && user && !creator) {
      navigate("/signup");
      return;
    }

    if (creator) {
      fetchData();
    }
  }, [user, creator, loading, navigate]);

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
      .select('id, requester_name, requester_email, requester_profile_image_url, requested_date, status, created_at, ai_draft')
      .eq('creator_id', creator.id)
      .eq('hidden_by_creator', false)
      .order('created_at', { ascending: false });

    if (reqData) {
      setRequests(reqData);
      const approvedRequests = reqData.filter((r) => r.status === "approved");
      setBookedDates(approvedRequests.map((r) => r.requested_date));
      
      // Create booking details for calendar avatars
      setBookingDetails(
        approvedRequests.map((r) => ({
          date: r.requested_date,
          requesterName: r.requester_name,
          requesterProfileImageUrl: r.requester_profile_image_url,
        }))
      );
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const draftsCreatedCount = requests.filter((r) => r.ai_draft !== null).length;
  const thisMonthCollabs = requests.filter((r) => {
    const date = parseDateString(r.requested_date);
    const now = new Date();
    return (
      r.status === "approved" &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;

  const stats = [
    {
      icon: Users,
      label: "Outlines Created",
      subLabel: "Ready to refine",
      value: draftsCreatedCount,
      emptyTip: "Review a request to generate your first collaboration outline",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Clock,
      label: "Pending Requests",
      subLabel: "Awaiting your review",
      value: pendingCount,
      emptyTip: "Share your link to start receiving collaboration requests",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: Calendar,
      label: "Collaborations This Month",
      subLabel: "Scheduled this month",
      value: thisMonthCollabs,
      emptyTip: "Approve requests to fill your calendar",
      color: "text-success",
      bg: "bg-success/10",
    },
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
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm font-medium text-foreground">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.subLabel}</p>
                </div>
              </div>
              {stat.value === 0 && (
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
              collabMode={creator.collab_mode as 'async' | 'discovery' | null}
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
              <h2 className="text-xl font-semibold">Recent Requests</h2>
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
                  <p className="text-muted-foreground">No requests yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Share your link to start receiving requests
                  </p>
                </div>
              ) : (
                requests.slice(0, 5).map((request) => (
                  <motion.div
                    key={request.id}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/dashboard/requests")}
                  >
                    {request.requester_profile_image_url && !imageErrors.has(request.id) ? (
                      <img 
                        src={request.requester_profile_image_url} 
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
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
