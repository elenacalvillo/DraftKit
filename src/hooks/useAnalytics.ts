import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback } from "react";
import { Json } from "@/integrations/supabase/types";

export type AnalyticsEventType =
  | "page_view"
  | "booking_link_clicked"
  | "booking_submitted"
  | "draft_generated"
  | "draft_copied"
  | "user_signup"
  | "collab_approved"
  | "collab_declined";

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem("collabflow_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("collabflow_session_id", sessionId);
  }
  return sessionId;
}

export function useAnalytics() {
  const { user } = useAuth();

  const trackEvent = useCallback(
    async (
      eventType: AnalyticsEventType,
      eventData: Record<string, unknown> = {}
    ) => {
      try {
        await supabase.from("analytics_events").insert([{
          event_type: eventType,
          event_data: eventData as Json,
          user_id: user?.id || null,
          session_id: getOrCreateSessionId(),
          page_url: window.location.pathname,
        }]);
      } catch (e) {
        console.error("Failed to track event:", e);
      }
    },
    [user?.id]
  );

  return { trackEvent };
}
