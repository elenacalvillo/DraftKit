import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Search, Mail, ArrowLeft, Eye, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InviteCollaboratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  isPro: boolean;
  credits: number;
  onInvited: () => void;
}

interface CreatorProfile {
  id: string;
  name: string | null;
  username: string | null;
  profile_image_url: string | null;
}

export function InviteCollaboratorModal({
  open,
  onOpenChange,
  requestId,
  isPro,
  credits,
  onInvited,
}: InviteCollaboratorModalProps) {
  const [mode, setMode] = useState<"search" | "email">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreatorProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // Email fallback state
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Public view link state
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMode("search");
      setQuery("");
      setResults([]);
      setEmail("");
      setInvitingId(null);
      setCopied(false);
    }
  }, [open]);

  // Fetch view_token when modal opens
  useEffect(() => {
    if (!open || !requestId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("collab_requests").select("view_token").eq("id", requestId).maybeSingle();
      if (!cancelled && data?.view_token) {
        setViewToken(data.view_token as string);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, requestId]);

  const viewUrl = viewToken ? `${window.location.origin}/view/${viewToken}` : "";

  const handleCopyViewLink = async () => {
    if (!viewUrl) return;
    try {
      await navigator.clipboard.writeText(viewUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  // Debounced search
  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const { data } = await supabase
          .from("public_creator_profiles")
          .select("id, name, username, profile_image_url")
          .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
          .limit(5);
        setResults((data as CreatorProfile[]) || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, mode]);

  const handleProfileInvite = useCallback(
    async (creator: CreatorProfile) => {
      if (!isPro && credits < 1) {
        toast.error("You need at least 1 credit to invite a collaborator", {
          description: "Top up credits on the Membership page.",
        });
        return;
      }

      setInvitingId(creator.id!);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const { data, error } = await supabase.functions.invoke("invite-by-profile", {
          body: { requestId, creatorId: creator.id },
        });

        if (error) throw error;
        if (data?.error) {
          if (data.error.includes("already been invited")) {
            toast.error("This person has already been invited");
          } else {
            toast.error(data.error);
          }
          return;
        }

        toast.success(`Invited ${creator.name || creator.username}`);
        onInvited();
        onOpenChange(false);
      } catch (err: any) {
        console.error("Failed to invite by profile:", err);
        toast.error("Failed to send invitation. Please try again.");
      } finally {
        setInvitingId(null);
      }
    },
    [requestId, isPro, credits, onInvited, onOpenChange],
  );

  const handleEmailInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!isPro && credits < 1) {
      toast.error("You need at least 1 credit to invite a collaborator", {
        description: "Top up credits on the Membership page.",
      });
      return;
    }

    setIsSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: insertError } = await supabase.from("workspace_collaborators").insert({
        request_id: requestId,
        email: trimmed,
        invited_by: user.id,
      } as any);

      if (insertError) {
        if (insertError.message?.includes("duplicate key") || insertError.code === "23505") {
          toast.error("This person has already been invited");
        } else {
          throw insertError;
        }
        return;
      }

      if (!isPro) {
        await supabase
          .from("creators")
          .update({ credits: credits - 1 })
          .eq("user_id", user.id);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        supabase.functions
          .invoke("send-collab-email", {
            body: { type: "workspace_invite", requestId, inviteeEmail: trimmed },
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          .catch(() => {});
      }

      toast.success(`Invitation sent to ${trimmed}`);
      setEmail("");
      onInvited();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to invite collaborator:", err);
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add to Writer's Room
          </DialogTitle>
          <DialogDescription>
            Search for writers on DraftKit or invite by email.
            {!isPro && credits > 0 && (
              <span className="block mt-1 text-xs text-muted-foreground">
                This will use 1 credit. You have {credits} remaining.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Public view link — visible in both modes */}
          {viewToken && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Public view link
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap text-xs font-mono text-muted-foreground rounded border border-border/50 bg-background/50 px-2 py-1.5">
                  {viewUrl}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={handleCopyViewLink}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Anyone with this link can view the draft. Only invited writers can edit.
              </p>
            </div>
          )}

          {mode === "search" ? (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search for collaborators..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              {/* Results */}
              <div className="min-h-[120px]">
                {searching && <p className="text-sm text-muted-foreground text-center py-6">Searching…</p>}

                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No writers found matching "{query}"</p>
                )}

                {!searching && query.trim().length < 2 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Start typing a name or username to search
                  </p>
                )}

                {results.length > 0 && (
                  <div className="space-y-1">
                    {results.map((creator) => (
                      <button
                        key={creator.id}
                        onClick={() => handleProfileInvite(creator)}
                        disabled={invitingId === creator.id}
                        className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={creator.profile_image_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(creator.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{creator.name}</p>
                          {creator.username && (
                            <p className="text-xs text-muted-foreground truncate">@{creator.username}</p>
                          )}
                        </div>
                        <span className="text-xs text-primary font-medium shrink-0">
                          {invitingId === creator.id ? "Inviting…" : "Invite"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fallback to email */}
              <div className="border-t pt-3">
                <button
                  onClick={() => setMode("email")}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Can't find them? Send Email Invite
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Back to search */}
              <button
                onClick={() => setMode("search")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to search
              </button>

              <Input
                type="email"
                placeholder="writer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailInvite()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                They'll need to create an account to access the workspace.
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button variant="gradient" size="sm" onClick={handleEmailInvite} disabled={isSending || !email.trim()}>
                  {isSending ? "Sending…" : "Send Email Invite"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
