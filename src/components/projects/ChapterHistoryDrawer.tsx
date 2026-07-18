import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { History, RotateCcw, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useChapterRevisions,
  type ChapterRevision,
} from "@/hooks/useChapterRevisions";

interface ChapterHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  /** Only owners / project admins can restore. */
  canRestore: boolean;
  onRestored?: () => void;
}

const PREVIEW_ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "strong", "em", "s", "code", "pre", "a",
  "ul", "ol", "li", "br", "hr", "span",
];
const PREVIEW_ALLOWED_ATTR = ["href", "class"];

export function ChapterHistoryDrawer({
  open,
  onOpenChange,
  requestId,
  canRestore,
  onRestored,
}: ChapterHistoryDrawerProps) {
  const { revisions, isLoading, restore } = useChapterRevisions(
    open ? requestId : null,
  );
  const [selected, setSelected] = useState<ChapterRevision | null>(null);

  const handleRestore = async (rev: ChapterRevision) => {
    try {
      await restore.mutateAsync(rev.id);
      toast.success("Chapter restored to this version.");
      onRestored?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't restore this version.",
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Version history
          </SheetTitle>
          <SheetDescription>
            Automatic snapshots of this chapter. Up to 30 kept, one every
            couple of minutes while someone is editing.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 flex-1 min-h-0 mt-4">
          <ScrollArea className="border rounded-md h-[60vh] md:h-full">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            ) : revisions.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No snapshots yet. The next save will start the history.
              </div>
            ) : (
              <ul className="divide-y">
                {revisions.map((rev) => {
                  const isActive = selected?.id === rev.id;
                  return (
                    <li key={rev.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(rev)}
                        className={cn(
                          "w-full text-left px-3 py-2 hover:bg-muted/50",
                          isActive && "bg-muted",
                        )}
                      >
                        <div className="text-xs font-medium">
                          {formatDistanceToNow(new Date(rev.created_at), {
                            addSuffix: true,
                          })}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(new Date(rev.created_at), "MMM d, HH:mm")}
                        </div>
                        {rev.editor_name && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            by {rev.editor_name}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>

          <div className="flex flex-col min-h-0">
            {selected ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground">
                    Preview · {format(new Date(selected.created_at), "PPpp")}
                  </div>
                  {canRestore && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(selected)}
                      disabled={restore.isPending}
                    >
                      {restore.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Restore this version
                    </Button>
                  )}
                </div>
                <ScrollArea className="flex-1 border rounded-md">
                  <div
                    className="workspace-prose p-4 text-[14px] leading-[1.6]"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        selected.shared_content || "<p><em>Empty draft</em></p>",
                        { ALLOWED_TAGS: PREVIEW_ALLOWED_TAGS, ALLOWED_ATTR: PREVIEW_ALLOWED_ATTR },
                      ),
                    }}
                  />
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                Select a version to preview it.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
