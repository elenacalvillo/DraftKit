import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar, BookingInfo } from "@/components/calendar/CollabCalendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function Availability() {
  const navigate = useNavigate();
  const { user, creator, loading } = useAuth();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [bookingDetails, setBookingDetails] = useState<BookingInfo[]>([]);
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

      // Subscribe to real-time updates for collab_requests
      const channel = supabase
        .channel('availability-booked-dates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collab_requests',
            filter: `creator_id=eq.${creator.id}`,
          },
          () => {
            // Refetch booked dates when requests change
            fetchBookedDates();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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

    await fetchBookedDates();
  };

  const fetchBookedDates = async () => {
    if (!creator) return;
    
    const { data: reqData } = await supabase
      .from('collab_requests')
      .select('requested_date, requester_name, requester_profile_image_url')
      .eq('creator_id', creator.id)
      .eq('status', 'approved');

    if (reqData) {
      setBookedDates(reqData.map((r) => r.requested_date).filter(Boolean) as string[]);
      
      // Transform to BookingInfo array
      const details: BookingInfo[] = reqData
        .filter(r => r.requested_date)
        .map(r => ({
          date: r.requested_date as string,
          requesterName: r.requester_name,
          requesterProfileImageUrl: r.requester_profile_image_url,
        }));
      setBookingDetails(details);
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

    toast.success(
      creator.collab_mode === 'discovery' 
        ? "Availability updated" 
        : "Publishing dates updated"
    );
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
        {/* Header with back button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
            <Button variant="gradient" size="sm" asChild>
              <Link to="/dashboard">
                <Check className="w-4 h-4 mr-2" />
                Done
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">
              {creator.collab_mode === 'discovery' ? 'Availability' : 'Publishing Windows'}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {creator.collab_mode === 'discovery' 
              ? "Set the dates when you're available for intro calls"
              : 'Set the dates when collaborations can target going live'}
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
              <li>Click on a date to mark it as <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-available inline-block" />{creator.collab_mode === 'discovery' ? 'available for calls' : 'open for publishing'}</span></li>
              <li>Click again to remove {creator.collab_mode === 'discovery' ? 'availability' : 'the date'}</li>
              <li>Dates with a <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-booked inline-block" />coral</span> background are already booked</li>
            </ul>
          </div>
        </motion.div>

        {/* Guest Preview Context */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-4 mb-6 flex items-start gap-3 bg-accent/10 border border-accent/20"
        >
          <span className="text-lg">👁️</span>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">What guests will see</p>
            {creator.collab_mode === 'discovery' ? (
              <p>Guests will pick from your <span className="inline-flex items-center gap-1.5 align-baseline"><span className="w-2.5 h-2.5 rounded bg-available inline-block" /><span className="font-medium">highlighted dates</span></span> to schedule an intro call. They'll receive a calendar invite after booking.</p>
            ) : (
              <p>Guests will pick from your <span className="inline-flex items-center gap-1.5 align-baseline"><span className="w-2.5 h-2.5 rounded bg-available inline-block" /><span className="font-medium">highlighted dates</span></span> as a target publish date. They'll understand this is when you aim to ship — not a meeting.</p>
            )}
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
            bookingDetails={bookingDetails}
            isEditable={true}
            onToggleAvailable={handleToggleAvailable}
            onToggleBlocked={handleToggleBlocked}
            availableLegendText={
              creator.collab_mode === 'discovery' 
                ? 'Available for calls' 
                : 'Open for publishing'
            }
            collabMode={creator.collab_mode as 'async' | 'discovery' | null}
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
            <p className="text-sm text-muted-foreground">
              {creator.collab_mode === 'discovery' ? 'Available dates' : 'Publishing dates'}
            </p>
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
