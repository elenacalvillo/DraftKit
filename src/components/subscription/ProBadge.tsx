import { Crown, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  className?: string;
  size?: "sm" | "default";
  variant?: "pro" | "founder";
}

export function ProBadge({ className, size = "default", variant = "pro" }: ProBadgeProps) {
  const isFounder = variant === "founder";
  const Icon = isFounder ? Heart : Crown;
  const label = isFounder ? "Founder" : "Pro";

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "border-primary/50 text-primary bg-primary/5",
        size === "sm" && "text-xs px-1.5 py-0",
        className
      )}
    >
      <Icon className={cn("mr-1", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
      {label}
    </Badge>
  );
}
