import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { getCurrentUser, getAvailability, saveAvailability, getRequests } from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Availability() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const avail = getAvailability(user.username);
    if (avail) {
      setAvailableDates(avail.availableDates);
      setBlockedDates(avail.blockedDates);
    }

    const reqs = getRequests(user.username);
    setBookedDates(
      reqs.filter((r) => r.status === "approved").map((r) => r.requestedDate)
    );
  }, [user, navigate]);

  const handleToggleAvailable = (date: string) => {
    if (!user) return;

    let newAvailable: string[];
    let newBlocked = blockedDates;

    if (availableDates.includes(date)) {
      newAvailable = availableDates.filter((d) => d !== date);
    } else {
      newAvailable = [...availableDates, date];
      newBlocked = blockedDates.filter((d) => d !== date);
    }

    setAvailableDates(newAvailable);
    setBlockedDates(newBlocked);

    saveAvailability({
      username: user.username,
      availableDates: newAvailable,
      blockedDates: newBlocked,
      recurringDays: [],
    });

    toast.success("Availability updated");
  };

  const handleToggleBlocked = (date: string) => {
    if (!user) return;

    let newBlocked: string[];
    let newAvailable = availableDates;

    if (blockedDates.includes(date)) {
      newBlocked = blockedDates.filter((d) => d !== date);
    } else {
      newBlocked = [...blockedDates, date];
      newAvailable = availableDates.filter((d) => d !== date);
    }

    setBlockedDates(newBlocked);
    setAvailableDates(newAvailable);

    saveAvailability({
      username: user.username,
      availableDates: newAvailable,
      blockedDates: newBlocked,
      recurringDays: [],
    });

    toast.success("Availability updated");
  };

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
            <span className="gradient-text">Availability</span>
          </h1>
          <p className="text-muted-foreground">
            Set the dates when you're available for collaborations
          </p>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 mb-6 flex items-start gap-3"
        >
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How to use:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Click on a date to mark it as <span className="text-available font-medium">available</span></li>
              <li>Click again to remove availability</li>
              <li>Dates with <span className="text-booked font-medium">purple</span> background are already booked</li>
            </ul>
          </div>
        </motion.div>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CollabCalendar
            availableDates={availableDates}
            blockedDates={blockedDates}
            bookedDates={bookedDates}
            isEditable={true}
            onToggleAvailable={handleToggleAvailable}
            onToggleBlocked={handleToggleBlocked}
          />
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-4 mt-6"
        >
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-available">{availableDates.length}</p>
            <p className="text-sm text-muted-foreground">Available dates</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-booked">{bookedDates.length}</p>
            <p className="text-sm text-muted-foreground">Booked dates</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-blocked">{blockedDates.length}</p>
            <p className="text-sm text-muted-foreground">Blocked dates</p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
