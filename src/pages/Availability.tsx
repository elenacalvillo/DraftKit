import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Availability() {
  const navigate = useNavigate();
  const { user, creator, loading } = useAuth();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [availabilityId, setAvailabilityId] = useState<string | null>(null);

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
      setAvailabilityId(availData.id);
      setAvailableDates(availData.available_dates || []);
      setBlockedDates(availData.blocked_dates || []);
    }

    // Fetch booked dates from requests
    const { data: reqData } = await supabase
      .from('collab_requests')
      .select('requested_date')
      .eq('creator_id', creator.id)
      .eq('status', 'approved');

    if (reqData) {
      setBookedDates(reqData.map((r) => r.requested_date));
    }
  };

  const saveAvailability = async (newAvailable: string[], newBlocked: string[]) => {
    if (!creator) return;

    if (availabilityId) {
      // Update existing
      await supabase
        .from('availability')
        .update({
          available_dates: newAvailable,
          blocked_dates: newBlocked,
        })
        .eq('id', availabilityId);
    } else {
      // Create new
      const { data } = await supabase
        .from('availability')
        .insert({
          creator_id: creator.id,
          available_dates: newAvailable,
          blocked_dates: newBlocked,
          recurring_days: [],
        })
        .select()
        .single();

      if (data) {
        setAvailabilityId(data.id);
      }
    }

    toast.success("Availability updated");
  };

  const handleToggleAvailable = (date: string) => {
    if (!creator) return;

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
    saveAvailability(newAvailable, newBlocked);
  };

  const handleToggleBlocked = (date: string) => {
    if (!creator) return;

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
    saveAvailability(newAvailable, newBlocked);
  };

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
