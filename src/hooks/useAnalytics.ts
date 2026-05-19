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
  | "draft_accepted"
  | "draft_deleted"
  | "draft_exported_docx"
  | "draft_exported_google_docs"
  | "draft_exported_google_docs_oauth"
  | "draft_exported_google_docs_fallback"
  | "draft_export_new_tab_opened"
  | "draft_applied_to_workspace"
  // ---- Push to Substack (Pro export funnel) ----
  // Fired when a Pro user successfully pushes a draft to Substack — captures
  // the volume of one-click publishes vs. the legacy copy-paste flow.
  | "push_to_substack_success"
  // Fired when a free user clicks the (visible) Push to Substack button and
  // hits the upgrade gate. This is the PRIMARY conversion signal for the
  // Pro plan — every blocked click is a high-intent moment because it lands
  // right at the end of the drafting flow.
  | "push_to_substack_blocked"
  | "user_signup"
  | "collab_approved"
  | "collab_declined"
  | "collab_cancelled"
  | "collab_type_changed"
  // Funnel analytics
  | "analyze_collab_match_invoked"
  | "ai_match_suggestion_selected"
  | "draft_regeneration_requested"
  | "collab_rescheduled"
  // Workspace observability — added so we can detect access regressions
  // (e.g. broken collaborator visibility) without users having to report.
  | "workspace_opened"
  | "workspace_access_denied"
  | "workspace_message_sent"
  | "collaborator_invited"
  | "collaborator_removed"
  | "workspace_save_failed"
  | "workspace_save_recovered"
  | "profile_theme_changed"
  | "profile_theme_upgrade_prompt_shown"
  | "directory_waitlist_signup"
  // ---- Attribution & growth loops ----
  // Fired once on signup with { source, invite_request_id?, referrer_user_id?, ref_username? }
  | "signup_attribution"
  | "referral_link_copied"
  | "referral_visit"
  | "referral_credit_earned"
  | "invite_email_clicked"
  // ---- Discovery surface ----
  | "discovery_opened"
  | "discovery_filter_applied"
  | "discovery_profile_viewed"
  | "discovery_substack_opened"
  | "discovery_invite_clicked"
  // ---- Monetization funnel ----
  | "upgrade_prompt_shown"
  | "upgrade_prompt_clicked"
  | "checkout_started"
  | "checkout_completed"
  | "credits_purchase_started"
  | "credits_purchase_completed"
  // ---- Dashboard / nav ----
  | "dashboard_tile_clicked"
  | "nav_link_clicked"
  // ---- Email loop ----
  | "email_link_clicked"
  // ---- Ghost-user observability ----
  // Fired whenever the create_creator_profile RPC (or the
  // follow-up refreshCreator cache update) fails. Lets us
  // detect a fresh accumulation of ghost users without waiting
  // for the hourly pg_cron monitor to alert.
  | "creator_creation_failed";

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
