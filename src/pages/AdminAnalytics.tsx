import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Users,
  Copy,
  Clock,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Star,
  Calendar,
  CheckCircle,
  XCircle,
  Sparkles,
  RefreshCw,
  Zap,
  Target,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { format, subDays, parseISO } from "date-fns";
import { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_data: Json;
  created_at: string;
  session_id: string | null;
}

interface UserFeedback {
  id: string;
  rating: number | null;
  feedback_type: string;
  message: string;
  email: string | null;
  created_at: string;
  page_url: string | null;
}

interface DailyMetric {
  date: string;
  events: number;
}

interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  conversionFromPrevious: number;
  icon: React.ReactNode;
  color: string;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();
  
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [imageRefreshProgress, setImageRefreshProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAnalyticsData();
    }
  }, [isAdmin]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    
    // Fetch events from last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    
    const [eventsRes, feedbackRes] = await Promise.all([
      supabase
        .from("analytics_events")
        .select("*")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (eventsRes.data) {
      setEvents(eventsRes.data);
      
      // Calculate daily metrics
      const dailyCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        dailyCounts[date] = 0;
      }
      
      eventsRes.data.forEach((event) => {
        const date = format(parseISO(event.created_at), "yyyy-MM-dd");
        if (dailyCounts[date] !== undefined) {
          dailyCounts[date]++;
        }
      });
      
      setDailyMetrics(
        Object.entries(dailyCounts).map(([date, events]) => ({
          date: format(parseISO(date), "MMM d"),
          events,
        }))
      );
    }

    if (feedbackRes.data) {
      setFeedback(feedbackRes.data);
    }

    setIsLoading(false);
  };

  // Bulk refresh all missing profile images
  const refreshAllProfileImages = async () => {
    setIsRefreshingImages(true);
    setImageRefreshProgress({ current: 0, total: 0 });
    
    try {
      // Get all creators with missing profile images but have substack URL
      const { data: staleCreators, error } = await supabase
        .from('creators')
        .select('id, substack_url, name')
        .is('profile_image_url', null)
        .not('substack_url', 'is', null);
      
      if (error) {
        console.error("Failed to fetch stale creators:", error);
        return;
      }
      
      if (!staleCreators || staleCreators.length === 0) {
        alert("All creators already have profile images!");
        setIsRefreshingImages(false);
        return;
      }
      
      setImageRefreshProgress({ current: 0, total: staleCreators.length });
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < staleCreators.length; i++) {
        const creator = staleCreators[i];
        setImageRefreshProgress({ current: i + 1, total: staleCreators.length });
        
        try {
          const { data: profileData, error: profileError } = await supabase.functions.invoke(
            'fetch-substack-profile',
            { body: { substackUrl: creator.substack_url } }
          );
          
          if (!profileError && profileData?.imageUrl) {
            await supabase
              .from('creators')
              .update({ profile_image_url: profileData.imageUrl })
              .eq('id', creator.id);
            successCount++;
          } else {
            failCount++;
            console.log(`Failed to fetch image for ${creator.name}:`, profileError);
          }
        } catch (e) {
          failCount++;
          console.log(`Error fetching image for ${creator.name}:`, e);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      alert(`Profile image refresh complete!\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
    } catch (e) {
      console.error("Bulk refresh failed:", e);
      alert("Bulk refresh failed. Check console for details.");
    } finally {
      setIsRefreshingImages(false);
      setImageRefreshProgress({ current: 0, total: 0 });
    }
  };

  // Helper to safely extract event_data properties
  const getEventData = (event: AnalyticsEvent): Record<string, unknown> => {
    if (typeof event.event_data === 'object' && event.event_data !== null && !Array.isArray(event.event_data)) {
      return event.event_data as Record<string, unknown>;
    }
    return {};
  };

  // Calculate core funnel metrics
  const bookingClicks = events.filter((e) => e.event_type === "booking_link_clicked").length;
  const analyzeMatchInvoked = events.filter((e) => e.event_type === "analyze_collab_match_invoked").length;
  const bookingSubmits = events.filter((e) => e.event_type === "booking_submitted").length;
  const draftGenerated = events.filter((e) => e.event_type === "draft_generated").length;
  const draftCopied = events.filter((e) => e.event_type === "draft_copied").length;
  const draftRegenRequested = events.filter((e) => e.event_type === "draft_regeneration_requested").length;
  const aiSuggestionSelected = events.filter((e) => e.event_type === "ai_match_suggestion_selected").length;
  const userSignups = events.filter((e) => e.event_type === "user_signup").length;
  const collabApproved = events.filter((e) => e.event_type === "collab_approved").length;
  const collabDeclined = events.filter((e) => e.event_type === "collab_declined").length;

  // Calculate AI Attachment Rate: % of bookings that used AI-suggested topics
  const bookingsWithAiSuggestion = events.filter((e) => {
    if (e.event_type !== "booking_submitted") return false;
    const data = getEventData(e);
    return data.used_ai_suggestion === true;
  }).length;
  const aiAttachmentRate = bookingSubmits > 0 ? ((bookingsWithAiSuggestion / bookingSubmits) * 100) : 0;

  // Calculate Draft Acceptance Rate (DAR): draft_copied / draft_generated
  const draftAcceptanceRate = draftGenerated > 0 ? ((draftCopied / draftGenerated) * 100) : 0;
  const darNeedsAction = draftAcceptanceRate < 30 && draftGenerated > 0;

  // Calculate Regeneration Rate
  const regenerationRate = draftGenerated > 0 ? ((draftRegenRequested / draftGenerated) * 100) : 0;
  const regenNeedsAction = regenerationRate > 50 && draftGenerated > 0;

  // Calculate Guest-to-User Conversion
  // Match booking_submitted emails with subsequent user_signup
  const bookingEmails = events
    .filter((e) => e.event_type === "booking_submitted")
    .map((e) => {
      const data = getEventData(e);
      return data.requester_email as string | undefined;
    })
    .filter(Boolean);
  const guestConversionRate = bookingSubmits > 0 ? ((userSignups / bookingSubmits) * 100) : 0;
  const guestConversionNeedsAction = guestConversionRate < 5 && bookingSubmits >= 10;

  // Calculate Average Session Duration
  const sessionsWithDuration = events
    .filter((e) => e.event_type === "booking_submitted")
    .map((e) => {
      const data = getEventData(e);
      return data.session_duration_ms as number | undefined;
    })
    .filter((d): d is number => typeof d === "number" && d > 0);
  
  const avgSessionDurationMs = sessionsWithDuration.length > 0 
    ? sessionsWithDuration.reduce((sum, d) => sum + d, 0) / sessionsWithDuration.length 
    : 0;
  
  const formatDuration = (ms: number) => {
    if (ms === 0) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Build funnel steps
  const funnelSteps: FunnelStep[] = [
    {
      name: "Link Clicks",
      count: bookingClicks,
      percentage: 100,
      conversionFromPrevious: 100,
      icon: <Target className="w-4 h-4" />,
      color: "bg-primary",
    },
    {
      name: "AI Match Invoked",
      count: analyzeMatchInvoked,
      percentage: bookingClicks > 0 ? (analyzeMatchInvoked / bookingClicks) * 100 : 0,
      conversionFromPrevious: bookingClicks > 0 ? (analyzeMatchInvoked / bookingClicks) * 100 : 0,
      icon: <Sparkles className="w-4 h-4" />,
      color: "bg-accent",
    },
    {
      name: "Bookings Submitted",
      count: bookingSubmits,
      percentage: bookingClicks > 0 ? (bookingSubmits / bookingClicks) * 100 : 0,
      conversionFromPrevious: analyzeMatchInvoked > 0 ? (bookingSubmits / analyzeMatchInvoked) * 100 : (bookingClicks > 0 ? (bookingSubmits / bookingClicks) * 100 : 0),
      icon: <CheckCircle className="w-4 h-4" />,
      color: "bg-success",
    },
    {
      name: "Drafts Generated",
      count: draftGenerated,
      percentage: bookingClicks > 0 ? (draftGenerated / bookingClicks) * 100 : 0,
      conversionFromPrevious: bookingSubmits > 0 ? (draftGenerated / bookingSubmits) * 100 : 0,
      icon: <Zap className="w-4 h-4" />,
      color: "bg-primary",
    },
    {
      name: "Drafts Copied",
      count: draftCopied,
      percentage: bookingClicks > 0 ? (draftCopied / bookingClicks) * 100 : 0,
      conversionFromPrevious: draftGenerated > 0 ? (draftCopied / draftGenerated) * 100 : 0,
      icon: <Copy className="w-4 h-4" />,
      color: "bg-success",
    },
  ];

  // Feedback metrics
  const avgRating = feedback.filter((f) => f.rating).reduce((sum, f) => sum + (f.rating || 0), 0) / 
    (feedback.filter((f) => f.rating).length || 1);

  if (loading || isLoading) {
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold">Admin Analytics</h1>
            </div>
            
            {/* Admin Actions */}
            <button
              onClick={refreshAllProfileImages}
              disabled={isRefreshingImages}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRefreshingImages ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Refreshing {imageRefreshProgress.current}/{imageRefreshProgress.total}...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Refresh All Profile Images
                </>
              )}
            </button>
          </div>
          <p className="text-muted-foreground">
            Track key metrics, funnel performance, and user feedback
          </p>
        </motion.div>

        {/* Key Metrics Row 1 - Core Rates */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Draft Acceptance Rate (DAR) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={cn("glass-card", darNeedsAction && "ring-2 ring-destructive/50")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  Draft Acceptance Rate
                  {darNeedsAction && (
                    <Badge variant="destructive" className="ml-auto text-xs">
                      Action Needed
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", darNeedsAction ? "text-destructive" : "text-primary")}>
                  {draftAcceptanceRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {draftCopied} of {draftGenerated} drafts copied
                </p>
                {darNeedsAction && (
                  <p className="text-xs text-destructive mt-2">
                    Below 30% threshold - improve draft quality
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Attachment Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Attachment Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">{aiAttachmentRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bookingsWithAiSuggestion} of {bookingSubmits} bookings used AI ideas
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Regeneration Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className={cn("glass-card", regenNeedsAction && "ring-2 ring-accent/50")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Regeneration Rate
                  {regenNeedsAction && (
                    <Badge className="ml-auto text-xs bg-accent/20 text-accent border-accent/30">
                      High
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", regenNeedsAction ? "text-accent" : "text-foreground")}>
                  {regenerationRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {draftRegenRequested} regenerations of {draftGenerated} drafts
                </p>
                {regenNeedsAction && (
                  <p className="text-xs text-accent mt-2">
                    Above 50% - prompt quality may need work
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Guest-to-User Conversion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className={cn("glass-card", guestConversionNeedsAction && "ring-2 ring-yellow-500/50")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Guest Conversion
                  {guestConversionNeedsAction && (
                    <Badge className="ml-auto text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                      Low
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{guestConversionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {userSignups} signups from {bookingSubmits} guests
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Key Metrics Row 2 - Secondary */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Avg Session Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatDuration(avgSessionDurationMs)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From link click to booking
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Booking Conversion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">
                  {bookingClicks > 0 ? ((bookingSubmits / bookingClicks) * 100).toFixed(1) : "0"}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bookingSubmits} of {bookingClicks} link clicks converted
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  AI Suggestions Used
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{aiSuggestionSelected}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Topics selected from AI matches
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  User Signups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{userSignups}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Events Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Daily Events (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    events: { label: "Events", color: "hsl(var(--primary))" },
                  }}
                  className="h-[200px]"
                >
                  <AreaChart data={dailyMetrics}>
                    <defs>
                      <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorEvents)"
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* 5-Step Collaboration Funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Collaboration Funnel (5-Step)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {funnelSteps.map((step, index) => (
                    <div key={step.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{step.icon}</span>
                          <span className="text-sm font-medium">{step.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{step.count}</Badge>
                          {index > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({step.conversionFromPrevious.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${step.percentage}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className={step.color}
                        />
                      </div>
                      {index < funnelSteps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Collab Outcomes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="mb-8"
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Collaboration Outcomes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold text-success">{collabApproved}</div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Approved
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold text-destructive">{collabDeclined}</div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Declined
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold">
                    {collabApproved + collabDeclined > 0 
                      ? ((collabApproved / (collabApproved + collabDeclined)) * 100).toFixed(0)
                      : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Approval Rate</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold text-primary">{bookingSubmits - collabApproved - collabDeclined}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feedback Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  User Feedback
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 fill-accent text-accent" />
                  <span className="font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">avg rating</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedback.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No feedback yet. The feedback widget will collect responses.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rating</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="min-w-[300px]">Message</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedback.slice(0, 10).map((fb) => (
                        <TableRow key={fb.id}>
                          <TableCell>
                            {fb.rating ? (
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= fb.rating!
                                        ? "fill-accent text-accent"
                                        : "text-muted"
                                    }`}
                                  />
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {fb.feedback_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {fb.message}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {fb.page_url || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(parseISO(fb.created_at), "MMM d, HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
