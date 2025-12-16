import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, MessageSquare, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CollabRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  requested_date: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, creator, loading } = useAuth();
  const [availability, setAvailability] = useState<string[]>([]);
  const [requests, setRequests] = useState<CollabRequest[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);

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
      .select('*')
      .eq('creator_id', creator.id)
      .order('created_at', { ascending: false });

    if (reqData) {
      setRequests(reqData);
      setBookedDates(
        reqData.filter((r) => r.status === "approved").map((r) => r.requested_date)
      );
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const thisMonthCollabs = requests.filter((r) => {
    const date = new Date(r.requested_date);
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
      label: "Total Collabs",
      value: approvedCount,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Clock,
      label: "Pending Requests",
      value: pendingCount,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: Calendar,
      label: "This Month",
      value: thisMonthCollabs,
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

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, <span className="gradient-text">{creator.name}</span>
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your collaborations
          </p>
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
                <div>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
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
            <h2 className="text-xl font-semibold mb-4">Your Schedule</h2>
            <CollabCalendar
              availableDates={availability}
              bookedDates={bookedDates}
            />
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
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                      {request.requester_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.requester_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {new Date(request.requested_date).toLocaleDateString()}
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
