import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback } from "react";

// Add collab_cancelled to AnalyticsEventType
import { Json } from "@/integrations/supabase/types";

export type AnalyticsEventType =
  | "page_view"
  | "booking_link_clicked"
  | "booking_submitted"
  | "draft_generated"
  | "draft_copied"
  | "draft_exported_docx"
  | "draft_exported_google_docs"
  | "draft_exported_google_docs_oauth"
  | "draft_exported_google_docs_fallback"
  | "user_signup"
  | "collab_approved"
  | "collab_declined"
  | "collab_cancelled"
  | "collab_type_changed"
  // New events for funnel analytics
  | "analyze_collab_match_invoked"
  | "ai_match_suggestion_selected"
  | "draft_regeneration_requested";

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem("draftkit_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("draftkit_session_id", sessionId);
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
