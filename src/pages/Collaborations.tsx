import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, BookMarked, Inbox, PenLine, Send, Users, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sanitizeSubstackImageUrl, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMyWorkspaces, bucketWorkspace, type MyWorkspace, type WorkspaceRole } from "@/hooks/useMyWorkspaces";

type Bucket = "needs_response" | "active" | "published" | "archived";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  host: "You host",
  requester: "You pitched",
  collaborator: "Invited",
  project_owner: "Your project",
};

function workspaceTitle(w: MyWorkspace, currentUserName?: string | null): string {
  if (w.is_project_workspace) {
    return w.message || w.chapter_title || "Untitled chapter";
  }
  if (w.is_solo) {
    return w.message || "Solo Draft";
  }
  // Classic collab: use the counterpart's name
  if (w.role_in_workspace === "host") {
    return w.requester_name || "Collab request";
  }
  return w.host_name || "Collab";
}

function counterpartLine(w: MyWorkspace): string {
  if (w.is_project_workspace) {
    const parts = [w.project_title, w.chapter_order ? `Chapter ${w.chapter_order}` : null].filter(Boolean);
    return parts.join(" · ") || "Book chapter";
  }
  if (w.is_solo) return "Solo draft";
  if (w.role_in_workspace === "host") return `From ${w.requester_name || "guest"}`;
  return `Hosted by ${w.host_name || "creator"}`;
}

function activityLine(w: MyWorkspace): string {
  if (w.content_last_edited_at) {
    return `Last edited ${formatDistanceToNow(new Date(w.content_last_edited_at), { addSuffix: true })}${
      w.content_last_edited_by ? ` by ${w.content_last_edited_by}` : ""
    }`;
  }
  if (w.approved_at) return `Approved ${formatDistanceToNow(new Date(w.approved_at), { addSuffix: true })}`;
  return `Created ${formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}`;
}

function WorkspaceRow({ w }: { w: MyWorkspace }) {
  const navigate = useNavigate();
  const avatarUrl = w.role_in_workspace === "host"
    ? w.requester_profile_image_url
    : w.host_profile_image_url;
  const avatarFallback = (w.role_in_workspace === "host" ? w.requester_name : w.host_name)?.charAt(0) || "?";
  const title = workspaceTitle(w);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-4 py-4">
        <Avatar className="h-11 w-11">
          <AvatarImage src={avatarUrl ? sanitizeSubstackImageUrl(avatarUrl) : undefined} />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <p className="font-medium truncate">{title}</p>
            {w.is_project_workspace && (
              <Badge variant="outline" className="shrink-0 gap-1">
                <BookMarked className="h-3 w-3" />
                Project
              </Badge>
            )}
            {w.is_solo && !w.is_project_workspace && (
              <Badge variant="outline" className="shrink-0 gap-1">
                <Sparkles className="h-3 w-3" />
                Solo
              </Badge>
            )}
            <Badge variant="secondary" className="shrink-0">
              {ROLE_LABEL[w.role_in_workspace]}
            </Badge>
            {w.status === "published" && <Badge className="shrink-0">Published</Badge>}
            {w.status === "pending" && <Badge variant="destructive" className="shrink-0">Pending</Badge>}
          </div>
          <p className="text-sm text-muted-foreground truncate">{counterpartLine(w)}</p>
          <p className="text-xs text-muted-foreground truncate">{activityLine(w)}</p>
        </div>
        <Button size="sm" onClick={() => navigate(`/dashboard/workspace/${w.request_id}`)}>
          <PenLine className="h-4 w-4 mr-1" />
          Open
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Collaborations() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaces, isLoading } = useMyWorkspaces();

  const tabParam = searchParams.get("tab") as Bucket | null;
  const [tab, setTab] = useState<Bucket>(tabParam ?? "active");

  const buckets = useMemo(() => {
    const groups: Record<Bucket, MyWorkspace[]> = {
      needs_response: [],
      active: [],
      published: [],
      archived: [],
    };
    for (const w of workspaces) {
      groups[bucketWorkspace(w)].push(w);
    }
    return groups;
  }, [workspaces]);

  const handleTabChange = (value: string) => {
    const next = value as Bucket;
    setTab(next);
    setSearchParams(next === "active" ? {} : { tab: next });
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
          <div className="h-9 w-64 bg-muted rounded-md" />
          <div className="h-10 w-full bg-muted rounded-md" />
          <div className="grid gap-4 mt-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const active = buckets[tab];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Collaborations</h1>
            <p className="text-muted-foreground">
              Every shared writing space you're part of — guest posts, pitches, and book chapters.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard/discovery")}>
            <Users className="w-4 h-4 mr-2" />
            Find creators
          </Button>
        </div>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="needs_response">
              Needs response
              {buckets.needs_response.length > 0 && (
                <span className="ml-2 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                  {buckets.needs_response.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              {buckets.active.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">{buckets.active.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="published">
              Published
              {buckets.published.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">{buckets.published.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {active.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {tab === "needs_response" && "Nothing needs a response"}
              {tab === "active" && "No active drafts yet"}
              {tab === "published" && "Nothing published yet"}
              {tab === "archived" && "Nothing archived"}
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {tab === "active"
                ? "Approved collabs, sent pitches, and book chapters you're writing will appear here."
                : "This bucket is empty."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map((w) => <WorkspaceRow key={w.request_id} w={w} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
