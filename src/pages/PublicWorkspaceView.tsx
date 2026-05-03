import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "strong", "em", "s", "u", "code", "pre",
  "a", "ul", "ol", "li", "br", "hr", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td", "span", "img",
];
const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "colspan", "rowspan", "colwidth", "class"];

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

interface PublicSheet {
  request_id: string;
  project_title: string;
  shared_content: string | null;
  creator_name: string;
  creator_username: string | null;
}

export default function PublicWorkspaceView() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [sheet, setSheet] = useState<PublicSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasEditAccess, setHasEditAccess] = useState(false);

  // SEO: noindex/nofollow for private drafts
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  // Fetch the public snapshot
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_sheet", { _token: token });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setSheet(null);
      } else {
        const row = data[0] as PublicSheet;
        setSheet(row);
        document.title = `${row.project_title} · DraftKit`;
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Edit-access check (only for logged-in users, never blocks anon rendering)
  useEffect(() => {
    if (!user || !sheet?.request_id) {
      setHasEditAccess(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("has_workspace_access", {
        _user_id: user.id,
        _request_id: sheet.request_id,
      });
      if (!cancelled) setHasEditAccess(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sheet?.request_id]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            This draft is no longer available
          </h1>
          <p className="text-muted-foreground mb-6">
            The link may have expired or the draft was removed.
          </p>
          <Button asChild variant="gradient">
            <Link to="/">Go to DraftKit</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cleanContent = sheet.shared_content ? sanitize(sheet.shared_content) : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky contextual banner */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <DraftKitLogo size={28} />
            <span className="text-sm font-semibold text-foreground hidden sm:inline">
              DraftKit
            </span>
          </Link>

          {hasEditAccess ? (
            <Button asChild variant="gradient" size="sm">
              <Link to={`/dashboard/workspace/${sheet.request_id}`}>
                Enter Writer's Room
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden md:inline">
                You're viewing a shared draft
              </span>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden md:inline">
                Built in a DraftKit Writer's Room
              </span>
              <Button asChild variant="gradient" size="sm">
                <Link to="/signup">
                  Sign up free
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* The Sheet */}
      <article className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <header className="mb-10 pb-8 border-b border-border">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
            {sheet.project_title}
          </h1>
          <p className="text-sm text-muted-foreground">
            By <span className="text-foreground font-medium">{sheet.creator_name}</span>
            {sheet.creator_username && (
              <>
                {" · "}
                <Link
                  to={`/${sheet.creator_username}`}
                  className="text-primary hover:underline"
                >
                  @{sheet.creator_username}
                </Link>
              </>
            )}
          </p>
        </header>

        {cleanContent ? (
          <div
            className="workspace-prose workspace-prose-public"
            dangerouslySetInnerHTML={{ __html: cleanContent }}
          />
        ) : (
          <p className="text-muted-foreground italic text-center py-12">
            This draft is empty.
          </p>
        )}
      </article>

      {/* Footer CTA for anonymous viewers */}
      {!user && (
        <footer className="border-t border-border mt-16">
          <div className="max-w-3xl mx-auto px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This draft was built collaboratively in a DraftKit Writer's Room.
            </p>
            <Button asChild variant="gradient">
              <Link to="/signup">
                Create your own Writer's Room
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
