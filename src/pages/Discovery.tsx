import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Compass,
  ExternalLink,
  Link2,
  RefreshCw,
  Users,
  AlertCircle,
  CheckCircle2,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { sanitizeSubstackImageUrl } from "@/lib/utils";

interface DiscoveredPublication {
  id: string;
  subdomain: string;
  name: string;
  author_name: string | null;
  description: string | null;
  logo_url: string | null;
  subscriber_count: number | null;
  isOnDraftKit: boolean;
  draftKitUsername: string | null;
  draftKitName: string | null;
  draftKitProfileImage: string | null;
}

interface SearchedCreator {
  id: string;
  name: string | null;
  username: string | null;
  profile_image_url: string | null;
  bio: string | null;
}

const REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

function CreatorSearchSection({ currentUsername }: { currentUsername?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedCreator[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from("public_creator_profiles")
          .select("id, name, username, profile_image_url, bio")
          .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
          .not("username", "is", null)
          .limit(12);
        setResults(
          (data || []).filter((c) => c.username !== currentUsername)
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, currentUsername]);

  return (
    <div className="mb-8">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search DraftKit creators by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {searching && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      )}
      {results.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            DraftKit Creators
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {results.map((c) => (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  {c.profile_image_url ? (
                    <img
                      src={sanitizeSubstackImageUrl(c.profile_image_url)}
                      alt={c.name || ""}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {c.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{c.username}</p>
                  </div>
                  <Button variant="default" size="sm" asChild>
                    <a href={`/${c.username}`}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      View
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No creators found matching "{query}"
        </p>
      )}
    </div>
  );
}

function NewOnDraftKitSection({ currentUsername }: { currentUsername?: string }) {
  const { data: creators, isLoading } = useQuery({
    queryKey: ["new-on-draftkit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("public_creator_profiles")
        .select("id, name, username, profile_image_url, bio, created_at")
        .not("username", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []).filter((c) => c.username !== currentUsername);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">New on DraftKit</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!creators || creators.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">New on DraftKit</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {creators.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              {c.profile_image_url ? (
                <img
                  src={sanitizeSubstackImageUrl(c.profile_image_url)}
                  alt={c.name || ""}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{c.username}</p>
              </div>
              <Button variant="default" size="sm" asChild>
                <a href={`/${c.username}`}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  View
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


  pub,
  index,
  onCopyInvite,
}: {
  pub: DiscoveredPublication;
  index: number;
  onCopyInvite: (name: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
        <CardContent className="p-5 flex flex-col flex-1">
          <div className="flex items-start gap-3 mb-3">
            {pub.logo_url ? (
              <img
                src={sanitizeSubstackImageUrl(pub.logo_url)}
                alt={pub.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-muted-foreground">
                  {pub.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{pub.name}</h3>
              {pub.author_name && (
                <p className="text-xs text-muted-foreground truncate">
                  by {pub.author_name}
                </p>
              )}
            </div>
            {pub.isOnDraftKit && (
              <Badge className="shrink-0 text-xs font-semibold bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Accepting Collabs
              </Badge>
            )}
          </div>
          {pub.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
              {pub.description}
            </p>
          )}
          {!pub.description && <div className="flex-1" />}
          {pub.subscriber_count && (
            <p className="text-xs text-muted-foreground mb-3">
              <Users className="w-3 h-3 inline mr-1" />
              {pub.subscriber_count.toLocaleString()} subscribers
            </p>
          )}
          <div className="mt-auto">
            {pub.isOnDraftKit && pub.draftKitUsername ? (
              <Button variant="default" size="sm" className="w-full" asChild>
                <a href={`/${pub.draftKitUsername}`}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  View Profile
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onCopyInvite(pub.name)}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Copy Invite Link
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Discovery() {
  const { creator } = useAuth();
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);

  const fetchRecommendations = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke(
      "fetch-substack-recommendations",
      { body: {} }
    );
    if (error) throw error;
    if (data?.error && !data?.recommendations?.length) throw new Error(data.error);
    const recs = (data?.recommendations || []) as DiscoveredPublication[];
    // Client-side sort: isOnDraftKit first
    recs.sort((a, b) => (a.isOnDraftKit === b.isOnDraftKit ? 0 : a.isOnDraftKit ? -1 : 1));
    if (recs.length > 0) setLastFetchedAt(Date.now());
    return recs;
  }, []);

  const {
    data: recommendations,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["discovery-recommendations", creator?.id],
    queryFn: fetchRecommendations,
    enabled: !!(creator?.newsletter_url || creator?.substack_url),
    staleTime: REFRESH_COOLDOWN_MS,
    retry: 1,
  });

  const canRefresh = Date.now() - lastFetchedAt > REFRESH_COOLDOWN_MS;

  const handleRefresh = () => {
    if (!canRefresh) {
      toast({ title: "Please wait", description: "You can refresh once per hour." });
      return;
    }
    refetch();
  };

  const handleCopyInviteLink = (pubName: string) => {
    if (!creator?.username) return;
    const link = `${window.location.origin}/${creator.username}?ref=${creator.username}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Invite link copied!",
      description: `Share your booking page with ${pubName} to start collaborating.`,
    });
  };

  if (creator && !creator.substack_url && !creator.newsletter_url) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <Compass className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Discover Collaborators</h1>
          <p className="text-muted-foreground mb-6">
            Connect your Substack publication in{" "}
            <a href="/dashboard/settings" className="text-primary underline hover:text-primary/80">Settings</a>{" "}
            to discover writers you already recommend — and invite them to collaborate.
          </p>
          <Button variant="default" asChild>
            <a href="/dashboard/settings">Go to Settings</a>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Compass className="w-6 h-6 text-primary" />
              Discover Collaborators
            </h1>
            <p className="text-muted-foreground mt-1">
              Search for creators on DraftKit or browse your Substack recommendations.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching || !canRefresh}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Creator Search */}
        <CreatorSearchSection currentUsername={creator?.username} />

        {/* New on DraftKit */}
        <NewOnDraftKitSection currentUsername={creator?.username} />

        {/* Substack Recommendations */}
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Your Substack Recommendations
        </p>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive">
                Couldn't fetch recommendations. Try refreshing later.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && recommendations?.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No recommendations found</h3>
              <p className="text-sm text-muted-foreground">
                Your Substack publication doesn't have any recommendations yet.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && recommendations && recommendations.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((pub, index) => (
              <RecommendationCard
                key={pub.id}
                pub={pub}
                index={index}
                onCopyInvite={handleCopyInviteLink}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
