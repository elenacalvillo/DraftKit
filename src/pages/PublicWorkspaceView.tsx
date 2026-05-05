import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import { sanitizeSubstackImageUrl } from "@/lib/utils";
import { getInviterInitials, getInviteMessage, getInviteCtaLabel } from "@/lib/public-workspace";

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
  shared_content: string | null;
  creator_name: string;
  creator_username: string | null;
  creator_profile_image_url?: string | null;
  invite_message?: string | null;
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
  const inviterInitials = getInviterInitials(sheet.creator_name);
  const inviteMessage = getInviteMessage(sheet.invite_message);
  const ctaLabel = getInviteCtaLabel(sheet.creator_name);
  const profileImage = sheet.creator_profile_image_url
    ? sanitizeSubstackImageUrl(sheet.creator_profile_image_url)
    : null;

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
                {ctaLabel}
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

      {/* Invitation hero — visually dominant; the draft sits below for context */}
      <section
        aria-label="Invitation"
        className="max-w-3xl mx-auto px-6 pt-12 sm:pt-16 pb-8"
      >
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-primary/20 shadow-sm">
            {profileImage && (
              <AvatarImage src={profileImage} alt={sheet.creator_name} />
            )}
            <AvatarFallback className="text-xl sm:text-2xl font-semibold bg-primary/10 text-primary">
              {inviterInitials}
            </AvatarFallback>
          </Avatar>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-5 leading-tight">
            {sheet.creator_name}
          </h1>
          {sheet.creator_username && (
            <Link
              to={`/${sheet.creator_username}`}
              className="text-sm text-primary hover:underline mt-1"
            >
              @{sheet.creator_username}
            </Link>
          )}

          <p className="text-base sm:text-lg text-foreground mt-5">
            <span className="font-medium">{sheet.creator_name}</span> invited
            you to collaborate on this draft
          </p>

          <blockquote className="mt-4 max-w-xl rounded-2xl border border-border bg-muted/40 px-5 py-4 text-sm sm:text-base text-foreground/90 leading-relaxed">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
              A note from {sheet.creator_name.split(" ")[0] || sheet.creator_name}
            </span>
            <span
              className={
                sheet.invite_message ? "italic" : "italic text-muted-foreground"
              }
            >
              "{inviteMessage}"
            </span>
          </blockquote>

          {hasEditAccess ? (
            <Button asChild variant="gradient" size="lg" className="mt-6">
              <Link to={`/dashboard/workspace/${sheet.request_id}`}>
                {ctaLabel}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          ) : !user ? (
            <Button asChild variant="gradient" size="lg" className="mt-6">
              <Link to="/signup">
                Sign up to collaborate
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {/* Draft content — below-the-fold context */}
      <article className="max-w-3xl mx-auto px-6 pb-12 sm:pb-16">
        <header className="mb-8 pb-6 border-b border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            The draft
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            {sheet.project_title}
          </h2>
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
        <footer className="border-t border-border mt-8">
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
