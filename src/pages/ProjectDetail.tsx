import { useState } from "react";
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
} from "lucide-react";
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
import {
  CHAPTER_STAGES,
  CHAPTER_STAGE_LABEL,
  PROJECT_MEMBER_ROLES,
  type ChapterStage,
  type ProjectMemberRole,
  isValidChapterStageTransition,
  roleLabel,
} from "@/lib/access";
import { ProjectUpgradePrompt } from "@/components/projects/ProjectUpgradePrompt";
import { ExportBookDialog } from "@/components/projects/ExportBookDialog";
import { EditableChapterTitle } from "@/components/projects/EditableChapterTitle";

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
    createChapter,
    updateChapterStage,
    reorderChapters,
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

  const handleMove = async (chapterId: string, direction: "up" | "down") => {
    const idx = chapters.findIndex((c) => c.id === chapterId);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= chapters.length) return;
    const ordered = [...chapters];
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    try {
      await reorderChapters.mutateAsync(ordered.map((c) => c.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
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
            {chapters.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No chapters yet. Add your first chapter to start drafting.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {chapters.map((c, idx) => {
                  const stage: ChapterStage = (CHAPTER_STAGES as readonly string[]).includes(
                    c.chapter_stage ?? "",
                  )
                    ? (c.chapter_stage as ChapterStage)
                    : "draft";
                  const hasWriter = !!c.requester_user_id;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
                    >
                      <div className="flex flex-col gap-0.5">
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
                        <div className="text-xs text-muted-foreground">
                          Writer:{" "}
                          {c.requester_name || (
                            <span className="italic">Unassigned</span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-xs px-2 py-1 rounded ${STAGE_BADGE[stage]}`}
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
                        <SelectTrigger className="w-[170px]">
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
                          className="text-xs text-amber-700"
                        >
                          <ArrowRight className="w-3.5 h-3.5 inline mr-1" />
                          Assign writer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Members tab */}
          <TabsContent value="members" className="pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Manage project access. Invite editors, co-authors, or beta readers and assign roles to control who can view or edit your manuscript.
            </p>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
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
                    <SelectContent>
                      {PROJECT_MEMBER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
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
                          <SelectContent>
                            {PROJECT_MEMBER_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {roleLabel(r)}
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
