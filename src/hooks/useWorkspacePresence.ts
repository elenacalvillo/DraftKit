import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ActiveEditor {
  user_id: string;
  user_name: string;
  last_active_at: string;
  has_unsaved: boolean;
}

interface UseWorkspacePresenceOptions {
  requestId: string;
  userId: string | undefined;
  userName: string;
  isEditing: boolean;
}

export function useWorkspacePresence({
  requestId,
  userId,
  userName,
  isEditing,
}: UseWorkspacePresenceOptions) {
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  // Upsert presence
  const upsertPresence = useCallback(async (hasUnsaved = false) => {
    if (!userId) return;
    await supabase
      .from("workspace_presence")
      .upsert(
        {
          request_id: requestId,
          user_id: userId,
          user_name: userName,
          last_active_at: new Date().toISOString(),
          has_unsaved: hasUnsaved,
        } as any,
        { onConflict: "request_id,user_id" }
      );
  }, [requestId, userId, userName]);

  // Clear presence on stop editing
  const clearPresence = useCallback(async () => {
    if (!userId) return;
    // Set last_active_at far in the past to signal "not editing"
    await supabase
      .from("workspace_presence")
      .update({
        last_active_at: new Date(0).toISOString(),
        has_unsaved: false,
      } as any)
      .eq("request_id", requestId)
      .eq("user_id", userId);
  }, [requestId, userId]);

  // Fetch active editors
  const fetchPresence = useCallback(async () => {
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data } = await supabase
      .from("workspace_presence")
      .select("user_id, user_name, last_active_at, has_unsaved")
      .eq("request_id", requestId)
      .gt("last_active_at", cutoff) as any;
    
    if (data) {
      // Exclude self
      setActiveEditors(
        (data as ActiveEditor[]).filter((e) => e.user_id !== userId)
      );
    }
  }, [requestId, userId]);

  // Heartbeat while editing
  useEffect(() => {
    if (!isEditing || !userId) return;

    upsertPresence(false);
    heartbeatRef.current = setInterval(() => upsertPresence(true), 30_000);

    return () => {
      clearInterval(heartbeatRef.current);
      clearPresence();
    };
  }, [isEditing, userId, upsertPresence, clearPresence]);

  // Poll for other editors on mount + every 30s
  useEffect(() => {
    if (!userId) return;
    fetchPresence();
    const interval = setInterval(fetchPresence, 30_000);
    return () => clearInterval(interval);
  }, [userId, fetchPresence]);

  return { activeEditors };
}
