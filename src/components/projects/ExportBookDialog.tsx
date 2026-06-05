import { useState } from "react";
import { Crown, Download, FileArchive, FileText, FileType2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  exportBookProject,
  type BookExportFormat,
} from "@/lib/book-export";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";

interface ExportBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
}

interface FormatOption {
  id: BookExportFormat;
  title: string;
  description: string;
  icon: typeof FileText;
}

const FORMATS: FormatOption[] = [
  {
    id: "zip-docx",
    title: "ZIP of chapter .docx files",
    description:
      "One Word document per chapter, folder-style. Edit chapters individually in Word, Pages or Google Docs.",
    icon: FileArchive,
  },
  {
    id: "zip-md",
    title: "ZIP of chapter .md files",
    description:
      "One Markdown file per chapter. Perfect for Obsidian, Git workflows, or static-site publishing.",
    icon: FileType2,
  },
  {
    id: "pdf",
    title: "Combined PDF (whole book)",
    description:
      "Title page, table of contents, and every chapter merged into a single ready-to-share PDF.",
    icon: FileText,
  },
  {
    id: "docx",
    title: "Combined Word document",
    description:
      "Single .docx with title page, contents, and page breaks between chapters.",
    icon: FileText,
  },
];

export function ExportBookDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
}: ExportBookDialogProps) {
  const { trackEvent } = useAnalytics();
  const [selected, setSelected] = useState<BookExportFormat>("zip-docx");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(
    null,
  );

  const handleExport = async () => {
    setBusy(true);
    setProgress({ current: 0, total: 1, label: "Assembling files…" });
    trackEvent("book_export_started", { format: selected });
    // Yield to let the modal repaint before kicking off heavy work.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      await exportBookProject({
        projectId,
        projectTitle,
        format: selected,
        onProgress: (p) => setProgress(p),
      });
      trackEvent("book_export_completed", { format: selected });
      toast.success("Export ready — your download has started.");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pct = progress ? Math.round((progress.current / Math.max(1, progress.total)) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" /> Export book
          </DialogTitle>
          <DialogDescription>
            Download your entire book project in the format you need. Chapters use your saved order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const active = selected === f.id;
            return (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => setSelected(f.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all flex gap-3 items-start",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40",
                  busy && "opacity-60 cursor-not-allowed",
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{f.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {progress && (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground truncate">{progress.label}</div>
            <div className="text-[11px] text-muted-foreground/80">
              Compiling chapters. This may take a moment for longer projects — keep this tab open.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Exporting…
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1.5" /> Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
