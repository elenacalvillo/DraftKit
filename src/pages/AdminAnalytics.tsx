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
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { Json } from "@/integrations/supabase/types";

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

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();
  
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Calculate metrics
  const draftGenerated = events.filter((e) => e.event_type === "draft_generated").length;
  const draftCopied = events.filter((e) => e.event_type === "draft_copied").length;
  const draftToCopyRatio = draftGenerated > 0 ? ((draftCopied / draftGenerated) * 100).toFixed(1) : "0";
  
  const bookingClicks = events.filter((e) => e.event_type === "booking_link_clicked").length;
  const bookingSubmits = events.filter((e) => e.event_type === "booking_submitted").length;
  const conversionRate = bookingClicks > 0 ? ((bookingSubmits / bookingClicks) * 100).toFixed(1) : "0";
  
  const staleDrafts = draftGenerated - draftCopied;
  const staleRate = draftGenerated > 0 ? ((staleDrafts / draftGenerated) * 100).toFixed(1) : "0";

  const collabApproved = events.filter((e) => e.event_type === "collab_approved").length;
  const collabDeclined = events.filter((e) => e.event_type === "collab_declined").length;
  const userSignups = events.filter((e) => e.event_type === "user_signup").length;

  // Feedback by type
  const feedbackByType = feedback.reduce((acc, fb) => {
    acc[fb.feedback_type] = (acc[fb.feedback_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const feedbackPieData = Object.entries(feedbackByType).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const COLORS = ["hsl(265, 89%, 58%)", "hsl(25, 95%, 63%)", "hsl(152, 69%, 45%)", "hsl(210, 90%, 65%)"];

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
            Track key metrics and user feedback to measure success
          </p>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  Draft-to-Copy Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{draftToCopyRatio}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {draftCopied} of {draftGenerated} drafts copied
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Collaborator Conversion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{conversionRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bookingSubmits} of {bookingClicks} link clicks converted
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Draft Stale Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">{staleRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {staleDrafts} drafts never copied
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
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
            transition={{ delay: 0.5 }}
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

          {/* Collaboration Funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Collaboration Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Link Clicks</span>
                    <Badge variant="secondary">{bookingClicks}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "100%" }} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Submissions</span>
                    <Badge variant="secondary">{bookingSubmits}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${bookingClicks > 0 ? (bookingSubmits / bookingClicks) * 100 : 0}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      Approved
                    </span>
                    <Badge className="bg-success/10 text-success border-success/20">{collabApproved}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      Declined
                    </span>
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">{collabDeclined}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Feedback Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
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
