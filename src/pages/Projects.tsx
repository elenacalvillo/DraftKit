import { useState } from "react";
import { Archive, ArchiveRestore, BookMarked, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePro } from "@/hooks/usePro";
import {
  useCreateProject,
  useProjects,
  useToggleProjectArchive,
} from "@/hooks/useProjects";
import { ProjectUpgradePrompt } from "@/components/projects/ProjectUpgradePrompt";

export default function Projects() {
  const { isProject, isLoading: isProLoading } = usePro();
  const {
    activeProjects,
    archivedProjects,
    activeCount,
    canCreate,
    activeLimit,
    activeLimitMessage,
    isLoading,
  } = useProjects();
  const createProject = useCreateProject();
  const toggleArchive = useToggleProjectArchive();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleNewProject = () => {
    if (!canCreate) {
      toast.error(activeLimitMessage);
      return;
    }
    setShowCreate(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Title is required");
      return;
    }
    setTitleError(null);
    try {
      await createProject.mutateAsync({
        title,
        description: description || null,
      });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      toast.success("Project created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error(msg);
    }
  };

  const handleToggleArchive = async (id: string, archive: boolean) => {
    try {
      await toggleArchive.mutateAsync({ id, archive });
      if (archive) {
        toast.success("Slot Available — project archived");
      } else {
        toast.success("Project unarchived");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      toast.error(msg);
    }
  };

  if (isProLoading) {
    return (
      <DashboardLayout>
        <div className="text-muted-foreground p-6">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!isProject) {
    return (
      <DashboardLayout>
        <ProjectUpgradePrompt />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookMarked className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Book Projects</h1>
              <p className="text-sm text-muted-foreground">
                {activeCount}/{activeLimit} active project
                {activeCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleNewProject}
            disabled={!canCreate}
            title={!canCreate ? activeLimitMessage : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {!canCreate && (
          <Card className="mb-6 border-amber-500/30 bg-amber-50/40">
            <CardContent className="p-4 text-sm text-amber-900">
              {activeLimitMessage}
            </CardContent>
          </Card>
        )}

        {/* Active projects */}
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Active
          </h2>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading projects…</p>
          ) : activeProjects.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No active projects yet. Create your first book project to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {activeProjects.map((p) => (
                <motion.div
                  key={p.id}
                  whileHover={{ y: -2 }}
                  className="rounded-xl border border-border bg-card p-4 flex items-start justify-between"
                >
                  <Link to={`/dashboard/projects/${p.id}`} className="flex-1 min-w-0 pr-4">
                    <div className="font-medium truncate">{p.title}</div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleArchive(p.id, true)}
                  >
                    <Archive className="w-4 h-4 mr-1.5" /> Archive
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Archived projects */}
        {archivedProjects.length > 0 && (
          <section>
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
              Archived
            </h2>
            <div className="grid gap-3">
              {archivedProjects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-dashed border-border bg-muted/40 p-4 flex items-start justify-between opacity-80"
                >
                  <Link
                    to={`/dashboard/projects/${p.id}`}
                    className="flex-1 min-w-0 pr-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{p.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        Read-only
                      </Badge>
                    </div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleArchive(p.id, false)}
                    disabled={!canCreate}
                    title={!canCreate ? activeLimitMessage : undefined}
                  >
                    <ArchiveRestore className="w-4 h-4 mr-1.5" /> Unarchive
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New book project</DialogTitle>
              <DialogDescription>
                Give your book project a name. You can add chapters and
                invite collaborators next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="project-title">Title</Label>
                <Input
                  id="project-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                  required
                  autoFocus
                  placeholder="My next book"
                />
                {titleError && (
                  <p className="text-xs text-destructive mt-1">{titleError}</p>
                )}
              </div>
              <div>
                <Label htmlFor="project-description">Description (optional)</Label>
                <Textarea
                  id="project-description"
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
                onClick={() => setShowCreate(false)}
                disabled={createProject.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
