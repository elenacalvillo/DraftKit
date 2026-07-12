import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, PenLine } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sanitizeSubstackImageUrl } from "@/lib/utils";
import type { CollaboratorWorkspace } from "@/hooks/useCollaboratorWorkspaces";

interface SharedWorkspaceCardProps {
  workspace: CollaboratorWorkspace;
  compact?: boolean;
}

export function SharedWorkspaceCard({ workspace, compact = false }: SharedWorkspaceCardProps) {
  const navigate = useNavigate();
  const hostName = workspace.host_name || "Workspace host";
  const title = workspace.chapter_title || "Untitled workspace";
  const subtitle = workspace.is_project_workspace
    ? [workspace.project_title, workspace.chapter_order ? `Chapter ${workspace.chapter_order}` : null]
        .filter(Boolean)
        .join(" · ")
    : `Hosted by ${hostName}`;
  const activity = workspace.content_last_edited_at
    ? `Last edited ${formatDistanceToNow(new Date(workspace.content_last_edited_at), { addSuffix: true })}${
        workspace.content_last_edited_by ? ` by ${workspace.content_last_edited_by}` : ""
      }`
    : workspace.joined_at
      ? `Joined ${formatDistanceToNow(new Date(workspace.joined_at), { addSuffix: true })}`
      : "Invited collaborator";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className={compact ? "flex items-center gap-3 py-3" : "flex items-center gap-4 py-4"}>
        <Avatar className={compact ? "h-10 w-10" : "h-11 w-11"}>
          <AvatarImage
            src={
              workspace.host_profile_image_url
                ? sanitizeSubstackImageUrl(workspace.host_profile_image_url)
                : undefined
            }
          />
          <AvatarFallback>{hostName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium truncate">{title}</p>
            <Badge variant="outline" className="shrink-0">
              {workspace.is_project_workspace ? "Project" : workspace.role || "Collab"}
            </Badge>
            {workspace.status === "published" && <Badge className="shrink-0">Published</Badge>}
          </div>
          <p className="text-sm text-muted-foreground truncate">{subtitle || `Hosted by ${hostName}`}</p>
          {!compact && <p className="text-xs text-muted-foreground truncate">{activity}</p>}
        </div>
        {compact ? (
          <Button size="icon" variant="ghost" onClick={() => navigate(`/dashboard/workspace/${workspace.request_id}`)}>
            <BookOpen className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" onClick={() => navigate(`/dashboard/workspace/${workspace.request_id}`)}>
            <PenLine className="h-4 w-4 mr-1" />
            Open Workspace
          </Button>
        )}
      </CardContent>
    </Card>
  );
}