import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface BookingInfo {
  date: string;
  requesterName: string;
  requesterProfileImageUrl: string | null;
}

interface CollabCalendarProps {
  availableDates?: string[];
  bookedDates?: string[];
  blockedDates?: string[];
  bookingDetails?: BookingInfo[];
  onDateSelect?: (date: string) => void;
  isEditable?: boolean;
  onToggleAvailable?: (date: string) => void;
  onToggleBlocked?: (date: string) => void;
  availableLegendText?: string;
  collabMode?: 'async' | 'discovery' | null;
}

export function CollabCalendar({
  availableDates = [],
  bookedDates = [],
  blockedDates = [],
  bookingDetails = [],
  onDateSelect,
  isEditable = false,
  onToggleAvailable,
  onToggleBlocked,
  availableLegendText = "Available",
  collabMode,
}: CollabCalendarProps) {
  // Helper to get booking info for a date
  const getBookingInfo = (dateStr: string): BookingInfo | undefined => {
    return bookingDetails.find(b => b.date === dateStr);
  };
  // Calculate the first available month
  const firstAvailableDate = useMemo(() => {
    if (availableDates.length === 0) return null;
    const sortedDates = [...availableDates].sort();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find first available date that's not in the past
    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      if (date >= today) {
        return date;
      }
    }
    return null;
  }, [availableDates]);

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

  // Check if current month has any available dates
  const currentMonthHasAvailability = useMemo(() => {
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;
    return availableDates.some(date => date >= monthStart && date <= monthEnd);
  }, [availableDates, year, month, daysInMonth]);

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

    if (clickedDate < today) return;

    if (isEditable) {
      const status = getDateStatus(dateStr);
      if (status === "booked") return;
      
      if (status === "available") {
        onToggleAvailable?.(dateStr);
      } else if (status === "blocked") {
        onToggleBlocked?.(dateStr);
      } else {
        onToggleAvailable?.(dateStr);
      }
    } else {
      const status = getDateStatus(dateStr);
      if (status === "available") {
        setSelectedDate(dateStr);
        onDateSelect?.(dateStr);
      } else if (status !== "booked") {
        // Show helpful feedback when clicking unavailable dates
        if (firstAvailableDate) {
          const availMonth = monthNames[firstAvailableDate.getMonth()];
          toast.info(`No availability on this date. Check ${availMonth} for available dates.`, {
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

    const dayButton = (
      <motion.button
        key={day}
        whileHover={!isPast ? { scale: 1.1 } : {}}
        whileTap={!isPast ? { scale: 0.95 } : {}}
        onClick={() => handleDateClick(day)}
        disabled={isPast}
        className={cn(
          "h-12 w-12 rounded-xl font-medium transition-all duration-200 relative",
          isPast && "opacity-30 cursor-not-allowed",
          !isPast && status === "default" && "hover:bg-muted",
          status === "available" && !isPast && "bg-available/20 text-available hover:bg-available/30 hover:shadow-md",
          status === "booked" && "bg-booked/20 text-booked cursor-default",
          status === "blocked" && "bg-blocked/20 text-blocked",
          isSelected && "ring-2 ring-primary ring-offset-2"
        )}
      >
        {day}
        {status === "available" && !isPast && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 rounded-xl bg-available/10 -z-10"
          />
        )}
        {/* Show mini avatar for booked dates */}
        {status === "booked" && bookingInfo && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 z-10"
          >
            <Avatar className="w-5 h-5 border-2 border-background shadow-sm">
              <AvatarImage src={bookingInfo.requesterProfileImageUrl || undefined} alt={bookingInfo.requesterName} />
              <AvatarFallback className="text-[8px] bg-booked text-booked-foreground">
                {bookingInfo.requesterName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
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
                  <AvatarImage src={bookingInfo.requesterProfileImageUrl || undefined} alt={bookingInfo.requesterName} />
                  <AvatarFallback className="bg-booked text-booked-foreground">
                    {bookingInfo.requesterName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{bookingInfo.requesterName}</p>
                  <p className="text-xs text-muted-foreground">Collaboration booked</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      days.push(dayButton);
    }
  }

  return (
    <div className="glass-card p-6">
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
              Next available{" "}
              <span className="font-medium">
                {collabMode === 'discovery' ? 'call slots' : collabMode === 'async' ? 'publication dates' : 'dates'}
              </span>{" "}
              are in{" "}
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
      <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-available" />
          <span className="text-sm text-muted-foreground">{availableLegendText}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-booked" />
          <span className="text-sm text-muted-foreground">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blocked" />
          <span className="text-sm text-muted-foreground">Blocked</span>
        </div>
      </div>
    </div>
  );
}
