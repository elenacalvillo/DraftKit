import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectChapters } from "@/hooks/useProjectChapters";
import { cn } from "@/lib/utils";

interface ChapterNavigatorProps {
  projectId: string;
  currentChapterId: string;
}

const STAGE_LABEL: Record<string, string> = {
  draft: "Draft",
  editing: "Editing",
  ready: "Ready",
  published: "Published",
};

export function ChapterNavigator({
  projectId,
  currentChapterId,
}: ChapterNavigatorProps) {
  const navigate = useNavigate();
  const { chapters, isLoading } = useProjectChapters(projectId);
  const [open, setOpen] = useState(false);

  const { currentIdx, prev, next, prevPos, nextPos } = useMemo(() => {
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    return {
      currentIdx: idx,
      current: idx >= 0 ? chapters[idx] : null,
      prev: idx > 0 ? chapters[idx - 1] : null,
      next: idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null,
      prevPos: idx > 0 ? idx : null,
      nextPos: idx >= 0 && idx < chapters.length - 1 ? idx + 2 : null,
    };
  }, [chapters, currentChapterId]);

  const go = (id: string) => {
    setOpen(false);
    navigate(`/dashboard/workspace/${id}`);
  };

  // Alt+←/→ shortcuts, ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          t.isContentEditable
        ) return;
      }
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        go(prev.id);
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        go(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (isLoading || chapters.length <= 1) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="inline-flex items-center gap-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!prev}
              onClick={() => prev && go(prev.id)}
              aria-label="Previous chapter"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          {prev && (
            <TooltipContent side="bottom">
              Previous: {prevPos}. {prev.message}
            </TooltipContent>
          )}
        </Tooltip>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Pick chapter"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="w-[min(360px,90vw)] p-1 max-h-[60vh] overflow-auto"
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-1.5">
              Chapters ({chapters.length})
            </div>
            {chapters.map((c, i) => {
              const isCurrent = c.id === currentChapterId;
              const stageKey = (c.chapter_stage ?? "draft") as string;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => !isCurrent && go(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors",
                    isCurrent && "bg-accent/60 font-medium",
                  )}
                >
                  <span className="text-xs text-muted-foreground w-6 shrink-0 tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="truncate flex-1 min-w-0">
                    {c.message || "Untitled"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                    {STAGE_LABEL[stageKey] ?? stageKey}
                  </span>
                  {isCurrent && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!next}
              onClick={() => next && go(next.id)}
              aria-label="Next chapter"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          {next && (
            <TooltipContent side="bottom">
              Next: {nextPos}. {next.message}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
