import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FolderInput } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";

interface MoveChapterDialogProps {
  chapterId: string;
  chapterTitle: string;
  currentProjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved?: (targetProjectId: string) => void;
}

export function MoveChapterDialog({
  chapterId,
  chapterTitle,
  currentProjectId,
  open,
  onOpenChange,
  onMoved,
}: MoveChapterDialogProps) {
  const queryClient = useQueryClient();
  const { activeProjects, isLoading } = useProjects();
  const [targetId, setTargetId] = useState<string>("");
  const [moving, setMoving] = useState(false);

  const options = activeProjects.filter((p) => p.id !== currentProjectId);

  const handleMove = async () => {
    if (!targetId) return;
    setMoving(true);
    const { error } = await supabase.rpc("move_chapter_to_project", {
      _chapter_id: chapterId,
      _target_project_id: targetId,
    });
    setMoving(false);
    if (error) {
      toast.error(error.message || "Failed to move chapter");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["project_chapters", currentProjectId] });
    queryClient.invalidateQueries({ queryKey: ["project_chapters", targetId] });
    queryClient.invalidateQueries({ queryKey: ["my_workspaces"] });
    toast.success("Chapter moved", {
      action: {
        label: "Open destination",
        onClick: () => {
          window.location.href = `/dashboard/projects/${targetId}`;
        },
      },
    });
    onOpenChange(false);
    setTargetId("");
    onMoved?.(targetId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="w-5 h-5 text-primary" />
            Move chapter to another project
          </DialogTitle>
          <DialogDescription>
            Moving "{chapterTitle}". Chat history, collaborators, drafts, and
            edit history all move with it.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your projects…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't have another active project to move this chapter into.
            Create one first.
          </p>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium">Destination project</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {options.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The chapter is appended at the end of the destination and the
              remaining chapters here are re-numbered.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!targetId || moving || options.length === 0}>
            {moving ? "Moving…" : "Move chapter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
