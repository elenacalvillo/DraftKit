import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Info, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CollabCalendar, BookingInfo } from "@/components/calendar/CollabCalendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MIN_NOTICE_WEEKS_DEFAULT,
  MIN_NOTICE_WEEKS_MAX,
  MIN_NOTICE_WEEKS_MIN,
  clampMinimumNoticeWeeks,
} from "@/lib/minimum-notice";

const NOTICE_WEEK_OPTIONS = Array.from(
  { length: MIN_NOTICE_WEEKS_MAX - MIN_NOTICE_WEEKS_MIN + 1 },
  (_, i) => MIN_NOTICE_WEEKS_MIN + i,
);

const noticeOptionLabel = (weeks: number) => {
  if (weeks === 0) return "No buffer (guests can book any open date)";
  if (weeks === 1) return "1 week";
  return `${weeks} weeks`;
};

export default function Availability() {
  const navigate = useNavigate();
  const { user, creator, loading } = useAuth();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [bookingDetails, setBookingDetails] = useState<BookingInfo[]>([]);
  const [publishedDates, setPublishedDates] = useState<string[]>([]);
  const [publishedBookingDetails, setPublishedBookingDetails] = useState<BookingInfo[]>([]);
  const [availabilityId, setAvailabilityId] = useState<string | null>(null);
  const [minimumNoticeWeeks, setMinimumNoticeWeeks] = useState<number>(MIN_NOTICE_WEEKS_DEFAULT);
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  useEffect(() => {
    if (!creator) return;

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
      setAvailabilityId(availData.id);
      setAvailableDates(availData.available_dates || []);
      setBlockedDates(availData.blocked_dates || []);
      setMinimumNoticeWeeks(
        clampMinimumNoticeWeeks((availData as { minimum_notice_weeks?: number }).minimum_notice_weeks ?? 0),
      );
    }

    await fetchBookedDates();
  };

  const fetchBookedDates = async () => {
    if (!creator) return;

    const { data: reqData } = await supabase
      .from('collab_requests')
      .select('id, requested_date, requester_name, requester_profile_image_url, status')
      .eq('creator_id', creator.id)
      .in('status', ['approved', 'published']);

    if (reqData) {
      const approved = reqData.filter(r => r.status === 'approved' && r.requested_date);
      const published = reqData.filter(r => r.status === 'published' && r.requested_date);

      setBookedDates(approved.map((r) => r.requested_date as string));
      setBookingDetails(
        approved.map(r => ({
          date: r.requested_date as string,
          requesterName: r.requester_name,
          requesterProfileImageUrl: r.requester_profile_image_url,
          requestId: r.id,
        }))
      );

      setPublishedDates(published.map((r) => r.requested_date as string));
      setPublishedBookingDetails(
        published.map(r => ({
          date: r.requested_date as string,
          requesterName: r.requester_name,
          requesterProfileImageUrl: r.requester_profile_image_url,
          requestId: r.id,
        }))
      );
    }
  };

  const persistAvailability = async (
    fields: {
      available_dates?: string[];
      blocked_dates?: string[];
      minimum_notice_weeks?: number;
    },
    successMessage: string,
  ) => {
    if (!creator) return;

    if (availabilityId) {
      await supabase
        .from('availability')
        .update(fields)
        .eq('id', availabilityId);
    } else {
      const { data } = await supabase
        .from('availability')
        .insert({
          creator_id: creator.id,
          available_dates: fields.available_dates ?? [],
          blocked_dates: fields.blocked_dates ?? [],
          minimum_notice_weeks: fields.minimum_notice_weeks ?? MIN_NOTICE_WEEKS_DEFAULT,
          recurring_days: [],
        })
        .select()
        .single();

      if (data) {
        setAvailabilityId(data.id);
      }
    }

    toast.success(successMessage);
  };

  const saveDates = async (newAvailable: string[], newBlocked: string[]) => {
    await persistAvailability(
      { available_dates: newAvailable, blocked_dates: newBlocked },
      "Publishing dates updated",
    );
  };

  const handleNoticeChange = async (raw: string) => {
    const weeks = clampMinimumNoticeWeeks(Number(raw));
    setMinimumNoticeWeeks(weeks);
    setIsSavingNotice(true);
    try {
      await persistAvailability(
        { minimum_notice_weeks: weeks },
        weeks === 0
          ? "Buffer cleared — guests can book any open date"
          : `Buffer set to ${weeks} ${weeks === 1 ? "week" : "weeks"}`,
      );
    } finally {
      setIsSavingNotice(false);
    }
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
    saveDates(newAvailable, newBlocked);
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
    saveDates(newAvailable, newBlocked);
  };

  if (!creator) return null;

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
            <span className="gradient-text">Publishing Windows</span>
          </h1>
          <p className="text-muted-foreground">
            Set the dates when collaborations can target going live
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
              <li>
                Click on a date to mark it as{" "}
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-available inline-block" />
                  open for publishing
                </span>
              </li>
              <li>Click again to remove the date</li>
              <li>
                Dates with a{" "}
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-booked inline-block" />
                  coral
                </span>{" "}
                background are already booked
              </li>
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
            <p>
              Guests will pick from your{" "}
              <span className="inline-flex items-center gap-1.5 align-baseline">
                <span className="w-2.5 h-2.5 rounded bg-available inline-block" />
                <span className="font-medium">highlighted dates</span>
              </span>{" "}
              as a target publish date. They'll understand this is when you aim to ship — not a meeting.
            </p>
          </div>
        </motion.div>

        {/* DRAFT-001: Minimum notice period — sits ABOVE the calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="glass-card p-5 mb-6"
          data-testid="minimum-notice-control"
        >
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary mt-1 shrink-0" />
            <div className="flex-1">
              <label
                htmlFor="minimum-notice-weeks"
                className="font-medium text-foreground block mb-1"
              >
                Guests can&apos;t book within{" "}
                <span className="text-primary font-semibold" data-testid="minimum-notice-value">{minimumNoticeWeeks}</span>{" "}
                {minimumNoticeWeeks === 1 ? "week" : "weeks"} of today
              </label>
              <p className="text-sm text-muted-foreground mb-3">
                Use this to give yourself enough lead time between when a guest books and when content goes live. Already-booked dates inside the window stay visible — only future open dates are blocked.
              </p>
              <Select
                value={String(minimumNoticeWeeks)}
                onValueChange={handleNoticeChange}
                disabled={isSavingNotice}
              >
                <SelectTrigger
                  id="minimum-notice-weeks"
                  className="w-full sm:w-[320px]"
                >
                  <SelectValue placeholder="No buffer" />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_WEEK_OPTIONS.map((weeks) => (
                    <SelectItem key={weeks} value={String(weeks)}>
                      {noticeOptionLabel(weeks)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Default is no buffer (0 weeks). You can change this at any time — the public booking page updates immediately.
              </p>
            </div>
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
            publishedDates={publishedDates}
            publishedBookingDetails={publishedBookingDetails}
            isEditable={true}
            onToggleAvailable={handleToggleAvailable}
            onToggleBlocked={handleToggleBlocked}
            onBookedDateClick={(requestId) => navigate(`/dashboard/workspace/${requestId}`)}
            availableLegendText="Open for publishing"
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
            <p className="text-sm text-muted-foreground">Publishing dates</p>
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
