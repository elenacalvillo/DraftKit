import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METRIC_LEGENDS, type MetricLegendId } from "@/lib/metric-legends";
import { cn } from "@/lib/utils";

interface MetricInfoProps {
  id: MetricLegendId;
  className?: string;
  /** Optional accessible label; defaults to "How is this calculated?". */
  ariaLabel?: string;
}

/**
 * Small ⓘ icon that opens a Radix tooltip explaining a metric's formula.
 * Copy lives in src/lib/metric-legends.ts so it can be edited and tested
 * in one place.
 */
export function MetricInfo({ id, className, ariaLabel }: MetricInfoProps) {
  const legend = METRIC_LEGENDS[id];
  if (!legend) return null;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? "How is this calculated?"}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors",
            className,
          )}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[320px] space-y-1.5 text-xs leading-relaxed">
        <p>{legend.definition}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          <span className="font-sans font-medium text-foreground/80">Formula: </span>
          {legend.formula}
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Source: </span>
          {legend.source}
        </p>
        {legend.note && (
          <p className="text-[11px] text-muted-foreground/80 italic">{legend.note}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
