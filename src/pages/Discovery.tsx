import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Compass,
  ExternalLink,
  Link2,
  RefreshCw,
  Users,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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
    setLastFetchedAt(Date.now());
    return (data?.recommendations || []) as DiscoveredPublication[];
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
    enabled: !!creator?.substack_url,
    staleTime: REFRESH_COOLDOWN_MS,
    retry: 1,
  });

  const canRefresh = Date.now() - lastFetchedAt > REFRESH_COOLDOWN_MS;

  const handleRefresh = () => {
    if (!canRefresh) {
      toast({
        title: "Please wait",
        description: "You can refresh once per hour.",
      });
      return;
    }
    refetch();
  };

  const handleCopyInviteLink = (pubName: string) => {
    if (!creator?.username) return;
    const link = `${window.location.origin}/${creator.username}?ref=discovery`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Invite link copied!",
      description: `Share your booking page with ${pubName} to start collaborating.`,
    });
  };

  // No Substack URL set
  if (creator && !creator.substack_url) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <Compass className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Discover Collaborators</h1>
          <p className="text-muted-foreground mb-6">
            Connect your Substack publication in{" "}
            <a
              href="/dashboard/settings"
              className="text-primary underline hover:text-primary/80"
            >
              Settings
            </a>{" "}
            to discover writers you already recommend — and invite them to
            collaborate.
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Compass className="w-6 h-6 text-primary" />
              Discover Collaborators
            </h1>
            <p className="text-muted-foreground mt-1">
              Writers you recommend on Substack — invite them to collaborate on
              DraftKit.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching || !canRefresh}
            className="shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Loading */}
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

        {/* Error */}
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

        {/* Empty state */}
        {!isLoading && !error && recommendations?.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No recommendations found</h3>
              <p className="text-sm text-muted-foreground">
                Your Substack publication doesn't have any recommendations yet.
                Add some in your Substack dashboard to see them here.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results grid */}
        {!isLoading && recommendations && recommendations.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((pub, index) => (
              <motion.div
                key={pub.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col flex-1">
                    {/* Top row: avatar + name */}
                    <div className="flex items-start gap-3 mb-3">
                      {pub.logo_url ? (
                        <img
                          src={pub.logo_url}
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
                        <h3 className="font-semibold text-sm truncate">
                          {pub.name}
                        </h3>
                        {pub.author_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            by {pub.author_name}
                          </p>
                        )}
                      </div>
                      {pub.isOnDraftKit && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-xs bg-success/10 text-success border-success/20"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          On DraftKit
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    {pub.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                        {pub.description}
                      </p>
                    )}
                    {!pub.description && <div className="flex-1" />}

                    {/* Subscriber count */}
                    {pub.subscriber_count && (
                      <p className="text-xs text-muted-foreground mb-3">
                        <Users className="w-3 h-3 inline mr-1" />
                        {pub.subscriber_count.toLocaleString()} subscribers
                      </p>
                    )}

                    {/* Action */}
                    <div className="mt-auto">
                      {pub.isOnDraftKit && pub.draftKitUsername ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          asChild
                        >
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
                          onClick={() => handleCopyInviteLink(pub.name)}
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1.5" />
                          Copy Invite Link
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
