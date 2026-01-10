import { motion } from "framer-motion";
import { Calendar, ExternalLink, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollabRequest } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface RequestCardProps {
  request: CollabRequest;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
}

export function RequestCard({ request, onApprove, onDecline }: RequestCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusColors = {
    pending: "bg-accent/10 text-accent border-accent/20",
    approved: "bg-success/10 text-success border-success/20",
    declined: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className="glass-card p-6 hover-lift"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
            {request.requesterName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold">{request.requesterName}</h3>
            <a
              href={request.requesterSubstackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Substack
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border capitalize",
            statusColors[request.status]
          )}
        >
          {request.status}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>
            {request.requestedDate 
              ? `Requested: ${formatDate(request.requestedDate)}`
              : "Flexible - To be scheduled"
            }
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="w-4 h-4" />
          <span>{request.requesterEmail}</span>
        </div>
      </div>

      {/* Message */}
      {request.message && (
        <div className="bg-muted/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-muted-foreground italic">"{request.message}"</p>
        </div>
      )}

      {/* Actions */}
      {request.status === "pending" && (
        <div className="flex gap-3">
          <Button
            variant="gradient"
            className="flex-1"
            onClick={() => onApprove?.(request.id)}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onDecline?.(request.id)}
          >
            Decline
          </Button>
        </div>
      )}
    </motion.div>
  );
}
