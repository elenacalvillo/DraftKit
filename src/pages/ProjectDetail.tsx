import { useState, type CSSProperties, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  ArchiveRestore,
  BookMarked,
  ChevronUp,
  ChevronDown,
  Download,
  Info,
  Lock,
  Megaphone,
  Plus,
  UserPlus,
  Users,
  GripVertical,
  MoreVertical,
  Trash2,
  FolderInput,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePro } from "@/hooks/usePro";
import { useProject, useToggleProjectArchive } from "@/hooks/useProjects";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjectChapters } from "@/hooks/useProjectChapters";
import { useProjectBroadcasts } from "@/hooks/useProjectBroadcasts";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import {
  CHAPTER_STAGES,
  CHAPTER_STAGE_LABEL,
  PROJECT_MEMBER_ROLES,
  PROJECT_MEMBER_ROLE_BEST_FOR,
  type ChapterStage,
  type ProjectMemberRole,
  isValidChapterStageTransition,
  roleAccessSummary,
  roleDescription,
  roleLabel,
} from "@/lib/access";
import { ProjectUpgradePrompt } from "@/components/projects/ProjectUpgradePrompt";
import { ExportBookDialog } from "@/components/projects/ExportBookDialog";
import { EditableChapterTitle } from "@/components/projects/EditableChapterTitle";
import { MoveChapterDialog } from "@/components/projects/MoveChapterDialog";

const STAGE_BADGE: Record<ChapterStage, string> = {
  draft: "bg-slate-200 text-slate-800",
  peer_review: "bg-blue-100 text-blue-800",
  editorial: "bg-amber-100 text-amber-800",
  final: "bg-emerald-100 text-emerald-800",
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isProject, isLoading: isProLoading } = usePro();
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const toggleArchive = useToggleProjectArchive();
  const { members, inviteMember, removeMember, updateMemberRole } =
    useProjectMembers(projectId);
  const {
    chapters,
    isLoading: isChaptersLoading,
    createChapter,
    updateChapterStage,
    reorderChapters,
    swapChapters,
    deleteChapter,
  } = useProjectChapters(projectId);
  const { broadcasts, sendBroadcast } = useProjectBroadcasts(projectId);

  const [chapterTitle, setChapterTitle] = useState("");
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectMemberRole>(
    "chapter_writer",
  );
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [pendingRevert, setPendingRevert] = useState<{
    id: string;
    from: ChapterStage;
    to: ChapterStage;
  } | null>(null);
  const [moveChapter, setMoveChapter] = useState<{ id: string; title: string } | null>(null);
  const [showEditProject, setShowEditProject] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isProLoading || isProjectLoading) {
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
  if (!project) {
    return (
      <DashboardLayout>
        <Card className="max-w-xl mx-auto mt-12">
          <CardContent className="p-6 text-center">
            <p className="mb-4">Project not found.</p>
            <Button onClick={() => navigate("/dashboard/projects")}>Back</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const isReadOnly = project.is_archived;

  const handleCreateChapter = async () => {
    if (!chapterTitle.trim()) {
      toast.error("Chapter title is required");
      return;
    }
    try {
      const created = await createChapter.mutateAsync({ title: chapterTitle });
      setChapterTitle("");
      setShowCreateChapter(false);
      toast.success("Chapter created");
      // Drop the writer straight into the new chapter's workspace.
      if (created?.id) navigate(`/dashboard/workspace/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    try {
      await inviteMember.mutateAsync({ email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      toast.success("Invitation sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      toast.error(msg);
    }
  };

  const handleStatusChange = (
    chapterId: string,
    from: ChapterStage,
    to: ChapterStage,
    hasWriter: boolean,
  ) => {
    if (!isValidChapterStageTransition(from, to)) return;
    if (!hasWriter && to !== from) {
      toast.error("Assign a writer before advancing this chapter.");
      return;
    }
    const fromIdx = CHAPTER_STAGES.indexOf(from);
    const toIdx = CHAPTER_STAGES.indexOf(to);
    if (toIdx < fromIdx) {
      // Backward — confirm
      setPendingRevert({ id: chapterId, from, to });
      return;
    }
    updateChapterStage
      .mutateAsync({ chapterId, stage: to })
      .then(() => toast.success(`Moved to ${CHAPTER_STAGE_LABEL[to]}`))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed"),
      );
  };

  const confirmRevert = async () => {
    if (!pendingRevert) return;
    try {
      await updateChapterStage.mutateAsync({
        chapterId: pendingRevert.id,
        stage: pendingRevert.to,
      });
      toast.success(`Reverted to ${CHAPTER_STAGE_LABEL[pendingRevert.to]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPendingRevert(null);
    }
  };

  const handleMove = (chapterId: string, direction: "up" | "down") => {
    const idx = chapters.findIndex((c) => c.id === chapterId);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= chapters.length) return;
    const a = chapters[idx];
    const b = chapters[swap];
    // Fire-and-forget: optimistic update moves the row immediately.
    swapChapters
      .mutateAsync({
        aId: a.id,
        bId: b.id,
        aOrder: a.chapter_order ?? idx + 1,
        bOrder: b.chapter_order ?? swap + 1,
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to reorder"),
      );
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      await deleteChapter.mutateAsync({ chapterId });
      toast.success("Chapter deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete chapter");
    }
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newIds = arrayMove(chapters, oldIndex, newIndex).map((c) => c.id);
    reorderChapters
      .mutateAsync(newIds)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to reorder"),
      );
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    if (members.length === 0) {
      toast.warning(
        "There are no other members in this project yet.",
      );
      return;
    }
    try {
      await sendBroadcast.mutateAsync(broadcastMessage);
      setBroadcastMessage("");
      toast.success("Broadcast sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broadcast failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard/projects"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to projects
        </Link>
        <div className="flex items-start justify-between mb-6">
          <div className="flex gap-3">
            <BookMarked className="w-7 h-7 text-primary mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{project.title}</h1>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowEditProject(true)}
                    title="Edit project"
                    aria-label="Edit project"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {isReadOnly && (
                  <Badge variant="secondary">
                    <Lock className="w-3 h-3 mr-1" /> Archived (read-only)
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="w-4 h-4 mr-1.5" /> Export book
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toggleArchive
                  .mutateAsync({ id: project.id, archive: !project.is_archived })
                  .then(() =>
                    toast.success(
                      project.is_archived ? "Project unarchived" : "Slot Available",
                    ),
                  )
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Failed"),
                  )
              }
            >
              {project.is_archived ? (
                <>
                  <ArchiveRestore className="w-4 h-4 mr-1.5" /> Unarchive
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-1.5" /> Archive
                </>
              )}
            </Button>
          </div>
        </div>

        <ExportBookDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          projectId={project.id}
          projectTitle={project.title}
        />

        {moveChapter && (
          <MoveChapterDialog
            chapterId={moveChapter.id}
            chapterTitle={moveChapter.title}
            currentProjectId={project.id}
            open={!!moveChapter}
            onOpenChange={(o) => !o && setMoveChapter(null)}
          />
        )}

        <EditProjectDialog
          open={showEditProject}
          onOpenChange={setShowEditProject}
          project={{ id: project.id, title: project.title, description: project.description }}
        />

        <Tabs defaultValue="chapters">
          <TabsList>
            <TabsTrigger value="chapters">Chapters</TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-1.5" />
              Members
            </TabsTrigger>
            <TabsTrigger value="broadcast">
              <Megaphone className="w-4 h-4 mr-1.5" />
              Broadcasts
            </TabsTrigger>
          </TabsList>

          {/* Chapters tab */}
          <TabsContent value="chapters" className="pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Manage and organize your manuscript structure. Changing a chapter's workflow state updates its status for your team — your content is always safely preserved and never lost.
            </p>
            <div className="w-full mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                Workflow States are just progress labels. Your text stays fully intact, editable, and backed up across every transition.
              </span>
            </div>
            <div className="flex justify-end mb-3">
              <Button
                size="sm"
                onClick={() => setShowCreateChapter(true)}
                disabled={isReadOnly}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add chapter
              </Button>
            </div>
            {isChaptersLoading ? (
              <div className="space-y-2" aria-label="Loading chapters">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg border border-border bg-card flex items-center gap-3 px-4 animate-pulse"
                  >
                    <div className="w-4 h-4 rounded bg-muted" />
                    <div className="flex-1 h-3 rounded bg-muted" />
                    <div className="w-20 h-3 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : chapters.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No chapters yet. Add your first chapter to start drafting.
                </CardContent>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={chapters.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4 sm:space-y-2">
                    {chapters.map((c, idx) => {
                      const stage: ChapterStage = (CHAPTER_STAGES as readonly string[]).includes(
                        c.chapter_stage ?? "",
                      )
                        ? (c.chapter_stage as ChapterStage)
                        : "draft";
                      const hasWriter = !!c.requester_user_id;
                      return (
                        <SortableChapterRow
                          key={c.id}
                          id={c.id}
                          disabled={isReadOnly}
                        >
                          {({ dragHandleProps }) => {
                            const deleteDialog = !isReadOnly ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    aria-label="Delete chapter"
                                    className="hidden sm:inline-flex text-muted-foreground hover:text-destructive transition-colors p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this chapter?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This permanently removes &ldquo;{c.message ?? "Untitled chapter"}&rdquo; and all of its drafted content. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeleteChapter(c.id)}
                                    >
                                      Delete chapter
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : null;

                            const mobileOverflow = !isReadOnly ? (
                              <AlertDialog>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      aria-label="Chapter actions"
                                      className="sm:hidden text-muted-foreground hover:text-foreground p-2 -mr-1"
                                    >
                                      <MoreVertical className="w-5 h-5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem
                                      onClick={() => handleMove(c.id, "up")}
                                      disabled={idx === 0}
                                    >
                                      <ChevronUp className="w-4 h-4 mr-2" /> Move up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleMove(c.id, "down")}
                                      disabled={idx === chapters.length - 1}
                                    >
                                      <ChevronDown className="w-4 h-4 mr-2" /> Move down
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setMoveChapter({ id: c.id, title: c.message ?? "Untitled chapter" })
                                      }
                                    >
                                      <FolderInput className="w-4 h-4 mr-2" /> Move to project…
                                    </DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete chapter
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this chapter?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This permanently removes &ldquo;{c.message ?? "Untitled chapter"}&rdquo; and all of its drafted content. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeleteChapter(c.id)}
                                    >
                                      Delete chapter
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : null;

                            return (
                              <>
                                <div className="flex items-center gap-2 sm:gap-3 w-full">
                                  <button
                                    {...dragHandleProps}
                                    aria-label="Drag to reorder"
                                    className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:opacity-30"
                                    disabled={isReadOnly}
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </button>
                                  <div className="hidden sm:flex flex-col gap-0.5">
                                    <button
                                      aria-label="Move up"
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                      onClick={() => handleMove(c.id, "up")}
                                      disabled={isReadOnly || idx === 0}
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      aria-label="Move down"
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                      onClick={() => handleMove(c.id, "down")}
                                      disabled={isReadOnly || idx === chapters.length - 1}
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="flex-1 min-w-0 group">
                                    <div className="font-medium truncate">
                                      <EditableChapterTitle
                                        chapterId={c.id}
                                        title={c.message ?? "Untitled chapter"}
                                        canEdit={!isReadOnly}
                                        variant="row"
                                        prefix={`${idx + 1}.`}
                                        titleHref={`/dashboard/workspace/${c.id}`}
                                        titleClassName="group-hover:text-primary"
                                      />
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      Writer:{" "}
                                      {c.requester_name || (
                                        <span className="italic">Unassigned</span>
                                      )}
                                    </div>
                                  </div>

                                  <span
                                    className={`hidden sm:inline-flex text-xs px-2 py-1 rounded ${STAGE_BADGE[stage]}`}
                                  >
                                    {CHAPTER_STAGE_LABEL[stage]}
                                  </span>
                                  <Select
                                    value={stage}
                                    onValueChange={(value) =>
                                      handleStatusChange(
                                        c.id,
                                        stage,
                                        value as ChapterStage,
                                        hasWriter,
                                      )
                                    }
                                    disabled={isReadOnly}
                                  >
                                    <SelectTrigger className="hidden sm:flex w-[170px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CHAPTER_STAGES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                          {CHAPTER_STAGE_LABEL[s]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {!hasWriter && !isReadOnly && (
                                    <span
                                      title="Assign a writer before advancing"
                                      className="hidden sm:inline text-xs text-amber-700"
                                    >
                                      <ArrowRight className="w-3.5 h-3.5 inline mr-1" />
                                      Assign writer
                                    </span>
                                  )}
                                  {!isReadOnly && (
                                    <button
                                      aria-label="Move to another project"
                                      title="Move to another project"
                                      className="hidden sm:inline-flex text-muted-foreground hover:text-primary transition-colors p-1"
                                      onClick={() =>
                                        setMoveChapter({ id: c.id, title: c.message ?? "Untitled chapter" })
                                      }
                                    >
                                      <FolderInput className="w-4 h-4" />
                                    </button>
                                  )}
                                  {deleteDialog}
                                  {mobileOverflow}
                                </div>

                                <div className="sm:hidden flex items-center gap-2 w-full pl-6">
                                  <Select
                                    value={stage}
                                    onValueChange={(value) =>
                                      handleStatusChange(
                                        c.id,
                                        stage,
                                        value as ChapterStage,
                                        hasWriter,
                                      )
                                    }
                                    disabled={isReadOnly}
                                  >
                                    <SelectTrigger className="w-[140px] h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CHAPTER_STAGES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                          {CHAPTER_STAGE_LABEL[s]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {!hasWriter && !isReadOnly && (
                                    <span className="text-xs text-amber-700 whitespace-nowrap">
                                      <ArrowRight className="w-3.5 h-3.5 inline mr-1" />
                                      Assign writer
                                    </span>
                                  )}
                                </div>
                              </>
                            );
                          }}
                        </SortableChapterRow>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>


          {/* Members tab */}
          <TabsContent value="members" className="pt-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-sm text-muted-foreground">
                Manage project access. Invite editors, co-authors, or beta readers and assign roles to control who can view or edit your manuscript.
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="shrink-0 gap-1.5">
                    <Info className="w-4 h-4" />
                    What do roles do?
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[340px] p-4 space-y-3">
                  <p className="text-sm font-medium">Project roles</p>
                  {PROJECT_MEMBER_ROLES.map((r) => (
                    <div key={r} className="space-y-0.5">
                      <div className="text-sm font-medium">{roleLabel(r)}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {roleDescription(r)}
                      </div>
                      <div className="text-xs text-muted-foreground/80 italic">
                        Best for: {PROJECT_MEMBER_ROLE_BEST_FOR[r]}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground/70 pt-1 border-t border-border">
                    Owner (you) always has full control and can't be reassigned here.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-2 md:grid-cols-[1fr_200px_auto]">
                  <Input
                    type="email"
                    placeholder="Invite by email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isReadOnly}
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as ProjectMemberRole)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-w-[340px]">
                      {PROJECT_MEMBER_ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="py-2">
                          <div className="space-y-0.5">
                            <div className="font-medium">{roleLabel(r)}</div>
                            <div className="text-xs text-muted-foreground leading-snug whitespace-normal">
                              {roleDescription(r)}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInvite} disabled={isReadOnly}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Invite
                  </Button>
                </div>
                <div className="space-y-2">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No collaborators yet — invite your first team member above.
                    </p>
                  ) : (
                    members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {m.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {roleLabel(m.role)} · {roleAccessSummary(m.role)}
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            {m.joined_at ? "Joined" : "Pending invitation"}
                          </div>
                        </div>
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            updateMemberRole.mutateAsync({
                              memberId: m.id,
                              role: v as ProjectMemberRole,
                            })
                          }
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-w-[340px]">
                            {PROJECT_MEMBER_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="py-2">
                                <div className="space-y-0.5">
                                  <div className="font-medium">{roleLabel(r)}</div>
                                  <div className="text-xs text-muted-foreground leading-snug whitespace-normal">
                                    {roleDescription(r)}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember.mutateAsync(m.id)}
                          disabled={isReadOnly}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Broadcast tab */}
          <TabsContent value="broadcast" className="pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Send important updates or announcements to everyone participating in this book project. Past broadcasts will appear in your history below.
            </p>
            <Card className="mb-4">
              <CardContent className="p-4 space-y-3">
                <Label htmlFor="broadcast-message">
                  Send a message to all project members
                </Label>
                <Textarea
                  id="broadcast-message"
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Share an update with everyone on this project…"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendBroadcast}
                    disabled={
                      isReadOnly ||
                      sendBroadcast.isPending ||
                      !broadcastMessage.trim()
                    }
                  >
                    <Megaphone className="w-4 h-4 mr-1.5" /> Send broadcast
                  </Button>
                </div>
              </CardContent>
            </Card>
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
              History
            </h3>
            {broadcasts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
            ) : (
              <ul className="space-y-2">
                {broadcasts.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-border p-3 bg-card"
                  >
                    <div className="text-xs text-muted-foreground">
                      {b.sender_name} · {new Date(b.created_at).toLocaleString()}
                      {" · "}
                      {b.recipient_count} recipient{b.recipient_count === 1 ? "" : "s"}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{b.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCreateChapter} onOpenChange={setShowCreateChapter}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add chapter</DialogTitle>
            <DialogDescription>
              Create a new chapter workspace. You can assign a writer and
              advance through the review stages from the chapter card.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="chapter-title">Chapter title</Label>
            <Input
              id="chapter-title"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="Chapter 1: …"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreateChapter(false)}
              disabled={createChapter.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateChapter} disabled={createChapter.isPending}>
              Add chapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingRevert}
        onOpenChange={(open) => !open && setPendingRevert(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert chapter status?</DialogTitle>
            <DialogDescription>
              {pendingRevert ? (
                <>
                  You're about to move this chapter from{" "}
                  <strong>{CHAPTER_STAGE_LABEL[pendingRevert.from]}</strong> back to{" "}
                  <strong>{CHAPTER_STAGE_LABEL[pendingRevert.to]}</strong>. Reviewers and writers will
                  be notified of the change.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingRevert(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRevert}>Confirm revert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

type SortableChapterRowProps = {
  id: string;
  disabled?: boolean;
  children: (args: {
    dragHandleProps: Record<string, unknown>;
  }) => ReactNode;
};

function SortableChapterRow({ id, disabled, children }: SortableChapterRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-3 pr-2 sm:pr-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}
