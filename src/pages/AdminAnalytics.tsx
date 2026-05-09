import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnalyticsRangePicker } from "@/components/admin/AnalyticsRangePicker";
import { resolveRange, bucketLabel, type RangeKey } from "@/lib/analytics-range";
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
  Mail,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildNudge, strikeForCount, type NudgeStrike } from "@/lib/nudge-templates";

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
import { format, subDays, parseISO, formatDistanceToNow } from "date-fns";
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

interface InactiveUser {
  user_id: string;
  creator_id: string;
  name: string | null;
  email: string | null;
  credits: number;
  nudge_count: number;
  last_nudge_sent_at: string | null;
  last_sign_in_at: string | null;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const rangeKey: RangeKey = searchParams.get("range") || "last-7d";
  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);

  const setRangeKey = (next: RangeKey) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("range", next);
    setSearchParams(sp, { replace: true });
  };

  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [prevEvents, setPrevEvents] = useState<AnalyticsEvent[]>([]);
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAnalyticsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, rangeKey]);

  /**
   * Page through analytics_events for a given window, working around
   * Supabase's 1000-row default. Caps at 5000 rows to keep the page snappy;
   * older data is summarised on the chart but raw KPIs above already
   * reflect the selected range.
   */
  const fetchEventsInRange = async (startIso: string, endIso: string) => {
    const PAGE = 1000;
    const MAX_ROWS = 5000;
    const all: AnalyticsEvent[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("*")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all.push(...(data as AnalyticsEvent[]));
      if (data.length < PAGE) break;
    }
    return all;
  };

  const fetchAnalyticsData = async () => {
    setIsLoading(true);

    const [curEvents, prevEvts, feedbackRes] = await Promise.all([
      fetchEventsInRange(range.start, range.end),
      fetchEventsInRange(range.prevStart, range.prevEnd),
      supabase
        .from("user_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setEvents(curEvents);
    setPrevEvents(prevEvts);

    // Build daily/weekly buckets for the chart based on the range.
    const startMs = new Date(range.start).getTime();
    const bucketMs = range.bucket === "week" ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    const buckets: { date: string; events: number; ts: number }[] = [];
    for (let i = 0; i < range.bucketCount; i++) {
      const ts = startMs + i * bucketMs;
      buckets.push({ date: bucketLabel(new Date(ts), range.bucket), events: 0, ts });
    }
    for (const e of curEvents) {
      const ts = new Date(e.created_at).getTime();
      const idx = Math.floor((ts - startMs) / bucketMs);
      if (idx >= 0 && idx < buckets.length) buckets[idx].events += 1;
    }
    setDailyMetrics(buckets.map(({ date, events }) => ({ date, events })));

    if (feedbackRes.data) setFeedback(feedbackRes.data);

    await fetchInactiveUsers();
    setIsLoading(false);
  };

  const fetchInactiveUsers = async () => {
    const { data, error } = await (supabase as any).rpc("get_inactive_credit_users");
    if (error) {
      console.error("Failed to fetch inactive users:", error);
      return;
    }
    setInactiveUsers((data as InactiveUser[]) || []);
  };

  const handleSendNudge = async (u: InactiveUser, strike: NudgeStrike) => {
    setNudgingId(u.creator_id);
    try {
      const tpl = buildNudge(strike, u.name, u.credits);
      const clipboardText = `To: ${u.email ?? ""}\nSubject: ${tpl.subject}\n\n${tpl.body}`;
      await navigator.clipboard.writeText(clipboardText);

      const { error } = await (supabase as any).rpc("bump_nudge_count", { _creator_id: u.creator_id });
      if (error) throw error;

      toast.success(`Strike ${strike} copied — paste into your email client`);
      await fetchInactiveUsers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to record nudge");
    } finally {
      setNudgingId(null);
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

  // ---- Workspace save reliability (7d) ----
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const saveFailEvents = events.filter(
    (e) => e.event_type === "workspace_save_failed" && new Date(e.created_at).getTime() >= sevenDaysAgoMs,
  );
  const saveRecoveredCount = events.filter(
    (e) => e.event_type === "workspace_save_recovered" && new Date(e.created_at).getTime() >= sevenDaysAgoMs,
  ).length;
  const saveFailReasonCounts: Record<string, number> = {};
  for (const e of saveFailEvents) {
    const data = (e.event_data && typeof e.event_data === "object" ? (e.event_data as Record<string, unknown>) : {}) as Record<string, unknown>;
    const reason = (data.reason as string | undefined) ?? "unknown";
    saveFailReasonCounts[reason] = (saveFailReasonCounts[reason] || 0) + 1;
  }
  const topSaveFailReason = Object.entries(saveFailReasonCounts).sort((a, b) => b[1] - a[1])[0];

  // ---- Feature Usage Matrix (last 7d / 30d) ----
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  type Row = { event: string; d7: number; d30: number; users7: number };
  const usageMap = new Map<string, { d7: number; d30: number; users: Set<string> }>();
  for (const e of events) {
    const ts = new Date(e.created_at).getTime();
    const row = usageMap.get(e.event_type) ?? { d7: 0, d30: 0, users: new Set<string>() };
    row.d30 += 1;
    if (ts >= sevenDaysAgo) {
      row.d7 += 1;
      const uid = (e as unknown as { user_id?: string }).user_id;
      if (uid) row.users.add(uid);
    }
    usageMap.set(e.event_type, row);
  }
  const usageRows: Row[] = Array.from(usageMap.entries())
    .map(([event, v]) => ({ event, d7: v.d7, d30: v.d30, users7: v.users.size }))
    .sort((a, b) => b.d7 - a.d7 || b.d30 - a.d30);

  // ---- Signup Attribution breakdown ----
  const attributionCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type !== "signup_attribution") continue;
    const data = getEventData(e);
    const src = (data.source as string | undefined) ?? "unknown";
    attributionCounts[src] = (attributionCounts[src] || 0) + 1;
  }
  const attributionTotal = Object.values(attributionCounts).reduce((a, b) => a + b, 0);
  const attributionRows = Object.entries(attributionCounts)
    .map(([source, count]) => ({
      source,
      count,
      pct: attributionTotal > 0 ? (count / attributionTotal) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ---- Growth Loop Funnels ----
  const countOf = (t: string) => events.filter((e) => e.event_type === t).length;
  const referralFunnel = [
    { name: "Referral link copied", count: countOf("referral_link_copied") },
    { name: "Referral visits", count: countOf("referral_visit") },
    { name: "Signups (referral)", count: attributionCounts["referral"] || 0 },
  ];
  const inviteFunnel = [
    { name: "Invite emails sent", count: countOf("invite_sent") },
    { name: "Invite link clicks", count: countOf("invite_email_clicked") },
    { name: "Signups (invite)", count: attributionCounts["invite"] || 0 },
  ];
  const discoveryFunnel = [
    { name: "Discovery searches", count: countOf("discovery_search") + countOf("discovery_filter_applied") },
    { name: "Profile views", count: countOf("discovery_profile_viewed") },
    { name: "Substack opened", count: countOf("discovery_substack_opened") },
    { name: "Invite clicks", count: countOf("discovery_invite_clicked") },
  ];
  const upgradePromptShown = countOf("upgrade_prompt_shown");
  const upgradePromptClicked = countOf("upgrade_prompt_clicked");
  const checkoutStarted = countOf("checkout_started");
  const checkoutCompleted = countOf("checkout_completed");
  const monetizationFunnel = [
    { name: "Upgrade prompt shown", count: upgradePromptShown },
    { name: "Upgrade prompt clicked", count: upgradePromptClicked },
    { name: "Checkout started", count: checkoutStarted },
    { name: "Checkout completed", count: checkoutCompleted },
  ];


  // Calculate SMART Attachment Rate: % of bookings that used SMART-suggested topics
  const bookingsWithAiSuggestion = events.filter((e) => {
    if (e.event_type !== "booking_submitted") return false;
    const data = getEventData(e);
    return data.used_ai_suggestion === true;
  }).length;
  const aiAttachmentRate = bookingSubmits > 0 ? ((bookingsWithAiSuggestion / bookingSubmits) * 100) : 0;

  // Calculate Draft Acceptance Rate (DAR): unique requests with draft_accepted / draft_generated
  const acceptedRequestIds = new Set(
    events
      .filter((e) => e.event_type === "draft_accepted")
      .map((e) => {
        const data = getEventData(e);
        return (data.request_id as string | undefined) ?? `__no_req_${e.id}`;
      })
  );
  const draftAccepted = acceptedRequestIds.size;
  const draftAcceptanceRate = draftGenerated > 0 ? ((draftAccepted / draftGenerated) * 100) : 0;
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
      name: "SMART Match Invoked",
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
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Admin Analytics</h1>
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
                  {draftAccepted} of {draftGenerated} drafts accepted
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  unique drafts copied or downloaded ÷ drafts generated
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
                  SMART Suggestions Used
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{aiSuggestionSelected}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Topics selected from SMART matches
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
          >
            <Card className={cn("glass-card", saveFailEvents.length > 0 && "border-destructive/40")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Workspace save failures (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", saveFailEvents.length > 0 ? "text-destructive" : "text-success")}>
                  {saveFailEvents.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {topSaveFailReason
                    ? `Top reason: ${topSaveFailReason[0]} (${topSaveFailReason[1]}) · ${saveRecoveredCount} recovered`
                    : `${saveRecoveredCount} recovered · all clean`}
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

        {/* Growth Loop Funnels */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {[
            { title: "Referral Loop", icon: <Users className="w-5 h-5" />, steps: referralFunnel },
            { title: "Invite Loop", icon: <Sparkles className="w-5 h-5" />, steps: inviteFunnel },
            { title: "Discovery Loop", icon: <Target className="w-5 h-5" />, steps: discoveryFunnel },
            { title: "Monetization Funnel", icon: <Zap className="w-5 h-5" />, steps: monetizationFunnel },
          ].map((funnel, fi) => {
            const top = funnel.steps[0]?.count || 0;
            return (
              <motion.div
                key={funnel.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.15 + fi * 0.05 }}
              >
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {funnel.icon}
                      {funnel.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {funnel.steps.map((s, i) => {
                        const pct = top > 0 ? (s.count / top) * 100 : 0;
                        const prev = i > 0 ? funnel.steps[i - 1].count : s.count;
                        const conv = prev > 0 ? (s.count / prev) * 100 : 0;
                        return (
                          <div key={s.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{s.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{s.count}</Badge>
                                {i > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    ({conv.toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, delay: i * 0.05 }}
                                className="h-full bg-primary"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Signup Attribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="mb-8"
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Signup Attribution (last 30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attributionRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No attribution data yet. Signup sources will appear here as users join.
                </p>
              ) : (
                <div className="space-y-3">
                  {attributionRows.map((r) => (
                    <div key={r.source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{r.source.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{r.count}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {r.pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${r.pct}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-accent"
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2">
                    Total signups attributed: <span className="font-semibold">{attributionTotal}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Feature Usage Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="mb-8"
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Feature Usage Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usageRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No events recorded in the last 30 days.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[480px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-right">7d</TableHead>
                        <TableHead className="text-right">30d</TableHead>
                        <TableHead className="text-right">Unique users (7d)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageRows.map((r) => (
                        <TableRow key={r.event}>
                          <TableCell className="font-mono text-xs">{r.event}</TableCell>
                          <TableCell className="text-right">{r.d7}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{r.d30}</TableCell>
                          <TableCell className="text-right">{r.users7}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Inactive User Campaign */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15 }}
          className="mb-6"
        >
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Inactive User Campaign
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Users with credits and no login in 7+ days
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {inactiveUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nobody to nudge right now. All credit holders are active or have completed the campaign.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Last login</TableHead>
                        <TableHead>Nudges</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveUsers.map((u) => {
                        const strike = strikeForCount(u.nudge_count);
                        const recentlyNudged =
                          !!u.last_nudge_sent_at &&
                          Date.now() - new Date(u.last_nudge_sent_at).getTime() < 24 * 60 * 60 * 1000;
                        const tpl = strike ? buildNudge(strike, u.name, u.credits) : null;
                        return (
                          <TableRow key={u.creator_id}>
                            <TableCell>
                              <div className="font-medium text-sm">{u.name || "—"}</div>
                              <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{u.credits}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.last_sign_in_at
                                ? formatDistanceToNow(parseISO(u.last_sign_in_at), { addSuffix: true })
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{u.nudge_count}/3</span>
                                {u.last_nudge_sent_at && (
                                  <span className="text-[10px] text-muted-foreground">
                                    · {formatDistanceToNow(parseISO(u.last_nudge_sent_at), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {strike && tpl ? (
                                <Button
                                  variant={strike === 3 ? "outline" : "default"}
                                  size="sm"
                                  disabled={recentlyNudged || nudgingId === u.creator_id}
                                  onClick={() => handleSendNudge(u, strike)}
                                  title={recentlyNudged ? "Already nudged in the last 24h" : tpl.subject}
                                >
                                  <Send className="w-3.5 h-3.5 mr-1.5" />
                                  {tpl.label}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Campaign complete</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
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
                <div className="space-y-4">
                  {feedback.map((fb) => {
                    let pageLabel = fb.page_url || "";
                    try {
                      if (fb.page_url) {
                        const u = new URL(fb.page_url);
                        pageLabel = (u.pathname + u.search).replace(/\/$/, "") || "/";
                      }
                    } catch { /* keep raw */ }
                    return (
                      <div
                        key={fb.id}
                        className="rounded-lg border border-border/60 bg-muted/20 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge variant="outline" className="capitalize">
                            {fb.feedback_type}
                          </Badge>
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
                          ) : null}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(parseISO(fb.created_at), "MMM d, yyyy · HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
                          {fb.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/40">
                          {fb.email && (
                            <a
                              href={`mailto:${fb.email}`}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors break-all"
                            >
                              {fb.email}
                            </a>
                          )}
                          {fb.page_url && (
                            <a
                              href={fb.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                            >
                              <span className="truncate max-w-[200px]">{pageLabel}</span>
                              <TrendingUp className="w-3 h-3 rotate-45" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
