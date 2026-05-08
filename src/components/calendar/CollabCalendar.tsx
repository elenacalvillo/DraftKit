import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, parseDateString, sanitizeSubstackImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isWithinMinimumNotice } from "@/lib/minimum-notice";

export interface BookingInfo {
  date: string;
  requesterName: string;
  requesterProfileImageUrl: string | null;
  requestId?: string;
}

interface CollabCalendarProps {
  availableDates?: string[];
  bookedDates?: string[];
  blockedDates?: string[];
  bookingDetails?: BookingInfo[];
  publishedDates?: string[];
  publishedBookingDetails?: BookingInfo[];
  onDateSelect?: (date: string) => void;
  isEditable?: boolean;
  onToggleAvailable?: (date: string) => void;
  onToggleBlocked?: (date: string) => void;
  onBookedDateClick?: (requestId: string) => void;
  availableLegendText?: string;
  /**
   * DRAFT-001: Number of weeks of notice required from a guest. Available
   * dates inside this window become non-selectable (already-booked dates are
   * still rendered as booked). Ignored when `isEditable` is true.
   */
  minimumNoticeWeeks?: number;
  /**
   * DRAFT-001: Optional plain-language label describing the buffer to guests
   * (e.g. "Elena typically needs 2 weeks from content deadline to
   * publication"). Rendered above the calendar when present.
   */
  minimumNoticeLabel?: string | null;
}

export function CollabCalendar({
  availableDates = [],
  bookedDates = [],
  blockedDates = [],
  bookingDetails = [],
  publishedDates = [],
  publishedBookingDetails = [],
  onDateSelect,
  isEditable = false,
  onToggleAvailable,
  onToggleBlocked,
  onBookedDateClick,
  availableLegendText = "Available",
  minimumNoticeWeeks = 0,
  minimumNoticeLabel = null,
}: CollabCalendarProps) {
  // Helper to get booking info for a date
  const getBookingInfo = (dateStr: string): BookingInfo | undefined => {
    return bookingDetails.find(b => b.date === dateStr);
  };

  const getPublishedBookingInfo = (dateStr: string): BookingInfo | undefined => {
    return publishedBookingDetails.find(b => b.date === dateStr);
  };

  // DRAFT-001: when the buffer is active in guest mode, treat dates inside
  // the buffer as not-selectable. A creator-side calendar (`isEditable`)
  // is unaffected so the host can still see/edit those days.
  const noticeWeeks = !isEditable && minimumNoticeWeeks > 0 ? minimumNoticeWeeks : 0;
  const isInsideNotice = (dateStr: string): boolean =>
    noticeWeeks > 0 && isWithinMinimumNotice(dateStr, noticeWeeks);

  // Calculate the first selectable available month, respecting the buffer.
  const firstAvailableDate = useMemo(() => {
    if (availableDates.length === 0) return null;
    const sortedDates = [...availableDates].sort();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find first available date that's not in the past AND not in the buffer
    for (const dateStr of sortedDates) {
      const date = parseDateString(dateStr);
      if (!date) continue;
      if (date < today) continue;
      if (noticeWeeks > 0 && isInsideNotice(dateStr)) continue;
      return date;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates, noticeWeeks]);

  // Initialize to first available month or current month
  const [currentDate, setCurrentDate] = useState(() => {
    if (firstAvailableDate && !isEditable) {
      return new Date(firstAvailableDate.getFullYear(), firstAvailableDate.getMonth(), 1);
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Check if current month has any selectable dates (after buffer filtering).
  const currentMonthHasAvailability = useMemo(() => {
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;
    return availableDates.some((date) => {
      if (date < monthStart || date > monthEnd) return false;
      if (noticeWeeks > 0 && isInsideNotice(date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates, year, month, daysInMonth, noticeWeeks]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToAvailability = () => {
    if (firstAvailableDate) {
      setCurrentDate(new Date(firstAvailableDate.getFullYear(), firstAvailableDate.getMonth(), 1));
    }
  };

  const formatDate = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const getDateStatus = (dateStr: string) => {
    // Priority: published → booked → blocked → available → default
    if (publishedDates.includes(dateStr)) return "published";
    if (bookedDates.includes(dateStr)) return "booked";
    if (blockedDates.includes(dateStr)) return "blocked";
    if (availableDates.includes(dateStr)) return "available";
    return "default";
  };

  const handleDateClick = (day: number) => {
    const dateStr = formatDate(day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const clickedDate = new Date(year, month, day);
    const status = getDateStatus(dateStr);

    // Published dates are navigable — go to workspace
    if (status === "published") {
      const booking = getPublishedBookingInfo(dateStr);
      if (booking?.requestId && onBookedDateClick) {
        onBookedDateClick(booking.requestId);
      }
      return;
    }

    // Booked dates are always navigable — past or future
    if (status === "booked") {
      const booking = getBookingInfo(dateStr);
      if (booking?.requestId && onBookedDateClick) {
        onBookedDateClick(booking.requestId);
      }
      return;
    }

    if (clickedDate < today) return; // past non-booked dates: do nothing

    if (isEditable) {
      if (status === "available") {
        onToggleAvailable?.(dateStr);
      } else if (status === "blocked") {
        onToggleBlocked?.(dateStr);
      } else {
        onToggleAvailable?.(dateStr);
      }
    } else {
      // DRAFT-001: even if the host marked the date available, dates inside
      // the buffer can't be picked by a guest.
      if (status === "available" && !isInsideNotice(dateStr)) {
        setSelectedDate(dateStr);
        onDateSelect?.(dateStr);
      } else if (status === "available" && isInsideNotice(dateStr)) {
        toast.info(
          minimumNoticeLabel ||
            `That date is too close to today. Please pick a date at least ${minimumNoticeWeeks} ${minimumNoticeWeeks === 1 ? "week" : "weeks"} out.`,
        );
      } else {
        // Show helpful feedback when clicking unavailable dates.
        if (firstAvailableDate) {
          const availMonth = monthNames[firstAvailableDate.getMonth()];
          toast.info(`No publication dates on this date. Check ${availMonth} for available dates.`, {
            action: {
              label: `Go to ${availMonth}`,
              onClick: jumpToAvailability,
            },
          });
        } else {
          toast.info("This creator hasn't set any available dates yet.");
        }
      }
    }
  };

  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-12" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(day);
    const status = getDateStatus(dateStr);
    const isSelected = selectedDate === dateStr;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = new Date(year, month, day) < today;
    const bookingInfo = status === "booked" ? getBookingInfo(dateStr) : undefined;
    const publishedInfo = status === "published" ? getPublishedBookingInfo(dateStr) : undefined;

    // DRAFT-001: gray out (and prevent selection on) available dates that
    // fall inside the creator's notice window. Already-booked dates remain
    // visible as booked even when they're inside the buffer.
    const isBuffered =
      status === "available" && !isPast && isInsideNotice(dateStr);

    const dayButton = (
      <motion.button
        key={day}
        whileHover={(!isPast || status === "published" || status === "booked") && !isBuffered ? { scale: 1.1 } : {}}
        whileTap={(!isPast || status === "published" || status === "booked") && !isBuffered ? { scale: 0.95 } : {}}
        onClick={() => handleDateClick(day)}
        disabled={(isPast && status !== "booked" && status !== "published") || isBuffered}
        aria-disabled={isBuffered ? true : undefined}
        title={
          isBuffered
            ? minimumNoticeLabel ||
              `Inside the ${minimumNoticeWeeks}-week minimum notice window`
            : undefined
        }
        className={cn(
          "h-12 w-12 rounded-xl font-medium transition-all duration-200 relative",
          isPast && status !== "booked" && status !== "published" && "opacity-30 cursor-not-allowed",
          !isPast && status === "default" && "hover:bg-muted",
          status === "available" && !isPast && !isBuffered && "bg-available/20 text-available hover:bg-available/30 hover:shadow-md",
          status === "booked" && cn("bg-booked/20 text-booked", onBookedDateClick ? "cursor-pointer" : "cursor-default"),
          status === "blocked" && "bg-blocked/20 text-blocked",
          status === "published" && "bg-booked/10 text-booked opacity-60 cursor-pointer",
          isBuffered && "bg-muted/40 text-muted-foreground/60 cursor-not-allowed line-through decoration-muted-foreground/40",
          isSelected && "ring-2 ring-primary ring-offset-2"
        )}
      >
        {day}
        {status === "available" && !isPast && !isBuffered && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 rounded-xl bg-available/10 -z-10"
          />
        )}
        {/* Avatar badge for booked dates */}
        {status === "booked" && bookingInfo && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 z-10"
          >
            <Avatar className="w-5 h-5 border-2 border-background shadow-sm">
              <AvatarImage src={bookingInfo.requesterProfileImageUrl ? sanitizeSubstackImageUrl(bookingInfo.requesterProfileImageUrl) : undefined} alt={bookingInfo.requesterName} />
              <AvatarFallback className="text-[8px] bg-booked text-booked-foreground">
                {bookingInfo.requesterName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        )}
        {/* Checkmark badge for published dates */}
        {status === "published" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-foreground flex items-center justify-center border-2 border-background shadow-sm"
          >
            <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />
          </motion.div>
        )}
      </motion.button>
    );

    // Wrap booked dates with tooltip
    if (status === "booked" && bookingInfo) {
      days.push(
        <TooltipProvider key={day}>
          <Tooltip>
            <TooltipTrigger asChild>
              {dayButton}
            </TooltipTrigger>
            <TooltipContent side="top" className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={bookingInfo.requesterProfileImageUrl ? sanitizeSubstackImageUrl(bookingInfo.requesterProfileImageUrl) : undefined} alt={bookingInfo.requesterName} />
                  <AvatarFallback className="bg-booked text-booked-foreground">
                    {bookingInfo.requesterName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{bookingInfo.requesterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isPast ? "View Workspace →" : "Collaboration booked"}
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else if (status === "published" && publishedInfo) {
      // Tooltip for published dates
      days.push(
        <TooltipProvider key={day}>
          <Tooltip>
            <TooltipTrigger asChild>
              {dayButton}
            </TooltipTrigger>
            <TooltipContent side="top" className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-booked/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-booked" />
                </div>
                <div>
                  <p className="font-medium text-sm">{publishedInfo.requesterName}</p>
                  <p className="text-xs text-muted-foreground">View published workspace →</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else if (status === "published") {
      // Published date with no booking info — still wrap with key
      days.push(<div key={day}>{dayButton}</div>);
    } else {
      days.push(dayButton);
    }
  }

  return (
    <div className="glass-card p-6">
      {/* DRAFT-001: minimum notice label (guest mode only). */}
      {minimumNoticeLabel && noticeWeeks > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-2"
          data-testid="minimum-notice-label"
        >
          <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{minimumNoticeLabel}</p>
        </motion.div>
      )}

      {/* Availability banner - show when current month has no availability */}
      {!isEditable && !currentMonthHasAvailability && firstAvailableDate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-primary/10 rounded-xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span>
              Next available <span className="font-medium">publication dates</span> are in{" "}
              <span className="font-medium text-primary">
                {monthNames[firstAvailableDate.getMonth()]} {firstAvailableDate.getFullYear()}
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={jumpToAvailability}
            className="shrink-0 text-primary hover:text-primary"
          >
            Jump there →
          </Button>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <AnimatePresence mode="wait">
          <motion.h2
            key={`${month}-${year}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-xl font-semibold"
          >
            {monthNames[month]} {year}
          </motion.h2>
        </AnimatePresence>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {dayNames.map((name) => (
          <div
            key={name}
            className="h-10 w-12 flex items-center justify-center text-sm font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <motion.div
        key={`${month}-${year}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-7 gap-2"
      >
        {days}
      </motion.div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-available" />
          <span className="text-sm text-muted-foreground">{availableLegendText}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-booked" />
          <span className="text-sm text-muted-foreground">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-booked/40 relative flex items-center justify-center">
            <Check className="w-2 h-2 text-foreground absolute" strokeWidth={3} />
          </div>
          <span className="text-sm text-muted-foreground">Published</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blocked" />
          <span className="text-sm text-muted-foreground">Blocked</span>
        </div>
        {noticeWeeks > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted/60 border border-border" />
            <span className="text-sm text-muted-foreground">Too soon to book</span>
          </div>
        )}
      </div>
    </div>
  );
}
