import { TrendingUp, Heart, MessageSquare, ExternalLink, BarChart3, RefreshCw, Edit2 } from "lucide-react";
import { useCollabMetrics, useTriggerMetricsSnapshot, useCollabUrls, useUpdateCollabUrls } from "@/hooks/useCollabMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface CollabImpactCardProps {
  requestId: string;
  creatorName?: string;
  requesterName?: string;
}

function MetricPill({ icon: Icon, value, label }: { icon: React.ElementType; value: number | null; label: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="font-medium">{value.toLocaleString()}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function GrowthIndicator({ current, previous, label }: { current: number | null; previous: number | null; label: string }) {
  if (current === null || previous === null || previous === 0) return null;
  const growth = current - previous;
  if (growth <= 0) return null;
  
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
      <TrendingUp className="w-3 h-3" />
      +{growth} {label}
    </span>
  );
}

export function CollabImpactCard({ requestId, creatorName, requesterName }: CollabImpactCardProps) {
  const { data: metrics, isLoading: isMetricsLoading } = useCollabMetrics(requestId);
  const { data: urls, isLoading: isUrlsLoading } = useCollabUrls(requestId);
  const { mutateAsync: updateUrls } = useUpdateCollabUrls();
  const { trigger, isCollecting, error: collectError } = useTriggerMetricsSnapshot(requestId);

  const [isEditingUrls, setIsEditingUrls] = useState(false);
  const [hostUrl, setHostUrl] = useState("");
  const [guestUrl, setGuestUrl] = useState("");
  const [isSavingUrls, setIsSavingUrls] = useState(false);

  useEffect(() => {
    if (urls && !isEditingUrls) {
      setHostUrl(urls.collab_link || "");
      setGuestUrl(urls.requester_collab_link || "");
    }
  }, [urls, isEditingUrls]);

  const handleCollect = async () => {
    if (isEditingUrls || !metrics?.length) {
      setIsSavingUrls(true);
      try {
        await updateUrls({ requestId, hostUrl, guestUrl });
      } catch (e) {
        console.error("Failed to update URLs", e);
      } finally {
        setIsSavingUrls(false);
        setIsEditingUrls(false);
      }
    }
    trigger();
  };

  const isLoading = isMetricsLoading || isUrlsLoading;

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // Empty state: no metrics yet, show collect button
  if (!metrics?.length) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span>Collab Impact</span>
        </div>
        <p className="text-sm text-muted-foreground">
          No engagement data collected yet for this collaboration.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => trigger()}
          disabled={isCollecting}
          className="gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCollecting ? "animate-spin" : ""}`} />
          {isCollecting ? "Collecting…" : "Collect engagement data"}
        </Button>
        {collectError && (
          <p className="text-xs text-destructive">{collectError}</p>
        )}
      </div>
    );
  }

  const latest = metrics[metrics.length - 1];
  const initial = metrics[0];
  const hasGrowth = metrics.length > 1;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span>Collab Impact</span>
        {hasGrowth && latest.snapshot_day > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            Day {latest.snapshot_day} snapshot
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {/* Creator's post metrics */}
        {(latest.creator_likes !== null || latest.creator_comments !== null) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{creatorName || "Host"}</span>
              <MetricPill icon={Heart} value={latest.creator_likes} label="likes" />
              <MetricPill icon={MessageSquare} value={latest.creator_comments} label="comments" />
              {hasGrowth && (
                <>
                  <GrowthIndicator current={latest.creator_likes} previous={initial.creator_likes} label="likes" />
                  <GrowthIndicator current={latest.creator_comments} previous={initial.creator_comments} label="comments" />
                </>
              )}
            </div>
            {latest.creator_post_url && (
              <a 
                href={latest.creator_post_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View post <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Requester's post metrics */}
        {(latest.requester_likes !== null || latest.requester_comments !== null) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{requesterName || "Guest"}</span>
              <MetricPill icon={Heart} value={latest.requester_likes} label="likes" />
              <MetricPill icon={MessageSquare} value={latest.requester_comments} label="comments" />
              {hasGrowth && (
                <>
                  <GrowthIndicator current={latest.requester_likes} previous={initial.requester_likes} label="likes" />
                  <GrowthIndicator current={latest.requester_comments} previous={initial.requester_comments} label="comments" />
                </>
              )}
            </div>
            {latest.requester_post_url && (
              <a 
                href={latest.requester_post_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View post <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70">
        Engagement data from Substack • {hasGrowth ? `Tracked over ${latest.snapshot_day} days` : "Initial snapshot"}
      </p>
    </div>
  );
}
