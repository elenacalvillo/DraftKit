import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUpdateProject } from "@/hooks/useProjects";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; title: string; description: string | null } | null;
}

export function EditProjectDialog({ open, onOpenChange, project }: EditProjectDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const updateProject = useUpdateProject();

  useEffect(() => {
    if (open && project) {
      setTitle(project.title);
      setDescription(project.description ?? "");
      setError(null);
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    try {
      await updateProject.mutateAsync({
        id: project.id,
        title,
        description: description || null,
      });
      toast.success("Project updated");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update project";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Rename the project or update its description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-project-title">Title</Label>
              <Input
                id="edit-project-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                required
                autoFocus
              />
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>
            <div>
              <Label htmlFor="edit-project-description">Description (optional)</Label>
              <Textarea
                id="edit-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={updateProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateProject.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
