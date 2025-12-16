import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollabCalendarProps {
  availableDates?: string[];
  bookedDates?: string[];
  blockedDates?: string[];
  onDateSelect?: (date: string) => void;
  isEditable?: boolean;
  onToggleAvailable?: (date: string) => void;
  onToggleBlocked?: (date: string) => void;
}

export function CollabCalendar({
  availableDates = [],
  bookedDates = [],
  blockedDates = [],
  onDateSelect,
  isEditable = false,
  onToggleAvailable,
  onToggleBlocked,
}: CollabCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
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

    days.push(
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
      </motion.button>
    );
  }

  return (
    <div className="glass-card p-6">
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
            className="h-10 flex items-center justify-center text-sm font-medium text-muted-foreground"
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
          <span className="text-sm text-muted-foreground">Available</span>
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
