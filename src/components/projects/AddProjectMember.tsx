import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { sanitizeSubstackImageUrl } from "@/lib/utils";
import {
  PROJECT_MEMBER_ROLES,
  roleDescription,
  roleLabel,
  type ProjectMemberRole,
} from "@/lib/access";
import { useProjectPeople, type ProjectPerson } from "@/hooks/useProjectPeople";

interface CreatorProfile {
  id: string;
  name: string | null;
  username: string | null;
  profile_image_url: string | null;
}

interface AddProjectMemberProps {
  projectId: string | undefined;
  disabled?: boolean;
  memberEmails: string[];
  onInviteByEmail: (email: string, role: ProjectMemberRole) => Promise<void>;
  onAddByCreator: (creatorId: string, role: ProjectMemberRole) => Promise<void>;
}

function personLabel(p: ProjectPerson): string {
  if (p.name?.trim()) return p.name;
  const local = p.email.split("@")[0] || p.email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

export function AddProjectMember({
  projectId,
  disabled,
  memberEmails,
  onInviteByEmail,
  onAddByCreator,
}: AddProjectMemberProps) {
  const [role, setRole] = useState<ProjectMemberRole>("chapter_writer");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreatorProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { people, isLoading: peopleLoading } = useProjectPeople(projectId);

  const known = useMemo(
    () => new Set(memberEmails.map((e) => e.trim().toLowerCase())),
    [memberEmails],
  );

  // Unique people across the project's chapters, not yet project members.
  const chapterPeople = useMemo(() => {
    const map = new Map<string, ProjectPerson>();
    for (const p of people) {
      if (known.has(p.email)) continue;
      if (!map.has(p.email)) map.set(p.email, p);
    }
    return Array.from(map.values());
  }, [people, known]);

  // Debounced writer search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const { data } = await supabase
          .from("public_creator_profiles")
          .select("id, name, username, profile_image_url")
          .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
          .limit(6);
        setResults((data as CreatorProfile[]) || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleCreator = async (creator: CreatorProfile) => {
    setBusy(creator.id);
    try {
      await onAddByCreator(creator.id, role);
      setQuery("");
      setResults([]);
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Email is required");
      return;
    }
    setBusy(trimmed);
    try {
      await onInviteByEmail(trimmed, role);
      setEmail("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-sm text-muted-foreground">
            Chapter authors are added here automatically. Add anyone else below.
          </p>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as ProjectMemberRole)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
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
        </div>

        <Tabs defaultValue="people">
          <TabsList>
            <TabsTrigger value="people">In this project</TabsTrigger>
            <TabsTrigger value="search">Search writers</TabsTrigger>
            <TabsTrigger value="email">By email</TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="pt-3 space-y-2">
            {peopleLoading ? (
              <p className="text-sm text-muted-foreground">Loading people…</p>
            ) : chapterPeople.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Everyone invited to a chapter is already a project member.
              </p>
            ) : (
              chapterPeople.map((p) => (
                <div
                  key={p.email}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage
                      src={
                        p.profile_image_url
                          ? sanitizeSubstackImageUrl(p.profile_image_url)
                          : undefined
                      }
                    />
                    <AvatarFallback>
                      {personLabel(p).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {personLabel(p)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.email}
                    </div>
                  </div>
                  <Badge
                    variant={p.joined_at ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    {p.joined_at ? "Joined" : "Pending invite"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || busy === p.email}
                    onClick={() => handleEmail(p.email)}
                  >
                    {busy === p.email ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1.5" /> Add
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="search" className="pt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or handle"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={disabled}
              />
            </div>
            {searching && (
              <p className="text-sm text-muted-foreground">Searching…</p>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No writers found. Use "By email" instead.
              </p>
            )}
            {results.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={
                      c.profile_image_url
                        ? sanitizeSubstackImageUrl(c.profile_image_url)
                        : undefined
                    }
                  />
                  <AvatarFallback>{(c.name || "?").charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.name || c.username}
                  </div>
                  {c.username && (
                    <div className="text-xs text-muted-foreground truncate">
                      @{c.username}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={disabled || busy === c.id}
                  onClick={() => handleCreator(c)}
                >
                  {busy === c.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1.5" /> Add
                    </>
                  )}
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="email" className="pt-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={disabled}
                />
              </div>
              <Button
                onClick={() => handleEmail(email)}
                disabled={disabled || busy === email.trim().toLowerCase()}
              >
                <UserPlus className="w-4 h-4 mr-1.5" /> Invite
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
