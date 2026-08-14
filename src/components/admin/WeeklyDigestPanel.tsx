import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Eye, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Bullet {
  title: string;
  body: string;
}

interface Preview {
  subject: string;
  bullets: Bullet[];
  commitCount: number;
  skipped?: boolean;
  reason?: string;
}

export function WeeklyDigestPanel() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const invoke = async (previewOnly: boolean) => {
    const { data, error } = await supabase.functions.invoke("send-weekly-digest", {
      body: { previewOnly },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const data = await invoke(true);
      if (data?.skipped) {
        setPreview(null);
        toast.info("Not enough shipped changes this week to build a digest.");
        return;
      }
      setPreview({
        subject: data.subject,
        bullets: data.bullets ?? [],
        commitCount: data.commitCount ?? 0,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const data = await invoke(false);
      if (data?.skipped) {
        toast.info("Skipped: not enough shipped changes this week.");
        return;
      }
      toast.success(`Digest sent: "${data.subject}"`);
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="glass-card mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          Weekly What's New broadcast
          <Badge variant="secondary" className="ml-1 font-normal">
            Fridays 16:00 UTC
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Builds this week's update from shipped commits and sends it to the full
          audience. Preview first, then send. Every run is logged so a silent stop
          is visible in the email log.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={loadingPreview || sending}
          >
            {loadingPreview ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 mr-2" />
            )}
            Preview digest
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || loadingPreview}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send now
          </Button>
        </div>

        {preview && (
          <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold">{preview.subject}</span>
              <Badge variant="outline" className="font-normal">
                {preview.commitCount} changes
              </Badge>
            </div>
            <ul className="space-y-2">
              {preview.bullets.map((b, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{b.title}</span>
                  <span className="block text-muted-foreground">{b.body}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
