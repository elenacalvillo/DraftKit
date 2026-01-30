import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  className?: string;
  size?: "sm" | "default";
}

export function ProBadge({ className, size = "default" }: ProBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "border-primary/50 text-primary bg-primary/5",
        size === "sm" && "text-xs px-1.5 py-0",
        className
      )}
    >
      <Crown className={cn("mr-1", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
      Pro
    </Badge>
  );
}
