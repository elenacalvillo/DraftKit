import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RequestCard } from "@/components/requests/RequestCard";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  getRequests,
  saveRequest,
  getAvailability,
  saveAvailability,
  CollabRequest,
} from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "pending" | "approved" | "declined";

export default function Requests() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [requests, setRequests] = useState<CollabRequest[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const reqs = getRequests(user.username);
    setRequests(reqs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  }, [user, navigate]);

  const handleApprove = (id: string) => {
    if (!user) return;

    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const updatedRequest = { ...request, status: "approved" as const };
    saveRequest(updatedRequest);

    // Update availability - remove the date from available and add to booked
    const avail = getAvailability(user.username);
    if (avail) {
      saveAvailability({
        ...avail,
        availableDates: avail.availableDates.filter(
          (d) => d !== request.requestedDate
        ),
      });
    }

    setRequests(
      requests.map((r) => (r.id === id ? updatedRequest : r))
    );

    toast.success(`Collaboration with ${request.requesterName} approved!`);
  };

  const handleDecline = (id: string) => {
    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const updatedRequest = { ...request, status: "declined" as const };
    saveRequest(updatedRequest);

    setRequests(
      requests.map((r) => (r.id === id ? updatedRequest : r))
    );

    toast.info(`Request from ${request.requesterName} declined`);
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
  ];

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
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
          {filteredRequests.length === 0 ? (
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
                  collabflow.com/{user.username}
                </code>
              </div>
            </motion.div>
          ) : (
            <div className="grid gap-6">
              {filteredRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <RequestCard
                    request={request}
                    onApprove={handleApprove}
                    onDecline={handleDecline}
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
