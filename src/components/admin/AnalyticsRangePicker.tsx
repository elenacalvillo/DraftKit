import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  type RangeKey,
  resolveRange,
  recentWeekOptions,
  recentMonthOptions,
} from "@/lib/analytics-range";

interface Props {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function AnalyticsRangePicker({ value, onChange }: Props) {
  const label = useMemo(() => resolveRange(value).label, [value]);
  const weeks = useMemo(() => recentWeekOptions(12), []);
  const months = useMemo(() => recentMonthOptions(12), []);
  const [customOpen, setCustomOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const applyCustom = () => {
    if (!customRange.from || !customRange.to) return;
    const f = customRange.from;
    const t = customRange.to;
    const key = `custom-${f.getFullYear()}${pad(f.getMonth() + 1)}${pad(f.getDate())}-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`;
    onChange(key);
    setCustomOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            <span className="font-medium">{label}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-popover">
          <DropdownMenuLabel>Quick ranges</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onChange("last-7d")} className={cn(value === "last-7d" && "bg-accent")}>
            Last 7 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("last-30d")} className={cn(value === "last-30d" && "bg-accent")}>
            Last 30 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("this-week")} className={cn(value === "this-week" && "bg-accent")}>
            This week
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("this-month")} className={cn(value === "this-month" && "bg-accent")}>
            This month
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Specific week…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto bg-popover">
              {weeks.map((w) => (
                <DropdownMenuItem
                  key={w.key}
                  onClick={() => onChange(w.key)}
                  className={cn(value === w.key && "bg-accent")}
                >
                  {w.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Specific month…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto bg-popover">
              {months.map((m) => (
                <DropdownMenuItem
                  key={m.key}
                  onClick={() => onChange(m.key)}
                  className={cn(value === m.key && "bg-accent")}
                >
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCustomOpen(true)}>Custom range…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover" align="start">
          <Calendar
            mode="range"
            selected={customRange as any}
            onSelect={(r: any) => setCustomRange(r ?? {})}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="flex justify-end gap-2 p-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyCustom} disabled={!customRange.from || !customRange.to}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
