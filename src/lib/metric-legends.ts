/**
 * Single source of truth for "how is this number calculated?"
 *
 * Every KPI / funnel / chart on the Dashboard and Admin Analytics pages
 * pulls its hover-tooltip copy from this map so the math is documented
 * exactly once. If you change a formula in code, update the matching
 * entry here.
 */

export interface MetricLegend {
  /** Plain-English one-liner — what the number means. */
  definition: string;
  /** Exact arithmetic, in the same words as the code. */
  formula: string;
  /** Where the numbers come from (table / event types). */
  source: string;
  /** Optional caveat or footnote (e.g. baseline disclaimers). */
  note?: string;
}

const LEGENDS = {
  // ---------- Dashboard (per-user) ----------
  ship_rate: {
    definition: "Share of your collab requests that turned into published work.",
    formula: "published requests ÷ eligible requests × 100 (eligible = not pending / declined / expired)",
    source: "collab_requests.status",
  },
  published_collabs: {
    definition: "Unique audiences you've shipped a collab with.",
    formula: "count of distinct requester_substack_url where status = 'published'",
    source: "collab_requests",
  },
  time_saved: {
    definition: "Estimated hours of manual coordination you've avoided.",
    formula: "published_count × (8.5h manual baseline − 1.0h with DraftKit) = published × 7.5h",
    source: "collab_requests.status = 'published'",
    note: "Baseline estimate, not measured per-user. We'll switch to a measured value once we have enough collab_metrics data.",
  },

  // ---------- Admin Analytics — KPI tiles ----------
  draft_acceptance_rate: {
    definition: "How often a generated draft gets copied / downloaded — your draft quality proxy.",
    formula: "unique request_ids with draft_accepted ÷ count(draft_generated) × 100",
    source: "analytics_events: draft_generated, draft_accepted",
    note: "Red ring fires below 30% when at least one draft was generated.",
  },
  ai_attachment_rate: {
    definition: "Share of bookings where the guest used a SMART-suggested topic.",
    formula: "bookings where event_data.used_ai_suggestion = true ÷ booking_submitted × 100",
    source: "analytics_events: booking_submitted",
  },
  regeneration_rate: {
    definition: "How often users ask for a re-roll — high values hint at prompt or quality issues.",
    formula: "draft_regeneration_requested ÷ draft_generated × 100",
    source: "analytics_events",
    note: "Amber ring fires above 50%.",
  },
  guest_conversion: {
    definition: "Share of guests who booked and then signed up for their own account.",
    formula: "user_signup ÷ booking_submitted × 100 (selected range)",
    source: "analytics_events",
    note: "Yellow ring fires below 5% once there are ≥10 bookings.",
  },
  avg_session_duration: {
    definition: "Average time from landing on a booking page to submitting the booking.",
    formula: "mean of event_data.session_duration_ms on booking_submitted events",
    source: "analytics_events: booking_submitted",
  },
  booking_conversion: {
    definition: "Share of booking-link clicks that became actual bookings.",
    formula: "booking_submitted ÷ booking_link_clicked × 100",
    source: "analytics_events",
  },
  smart_suggestions_used: {
    definition: "How many times a SMART-suggested topic was selected during booking.",
    formula: "raw count of ai_match_suggestion_selected in range",
    source: "analytics_events",
  },
  user_signups: {
    definition: "New accounts created in the selected window.",
    formula: "raw count of user_signup; Δ compares against the previous window of equal length",
    source: "analytics_events",
  },
  workspace_save_failures: {
    definition: "Failed save attempts in the Shared Workspace — your reliability pulse.",
    formula: "raw count of workspace_save_failed; top reason from event_data.reason",
    source: "analytics_events",
    note: "'Recovered' counts workspace_save_recovered events fired after a retry succeeds.",
  },

  // ---------- Admin Analytics — Push to Substack block ----------
  push_rate: {
    definition: "Adoption among users who tried to publish to Substack from the workspace.",
    formula: "push_to_substack_success ÷ (success + blocked) × 100, deduped by request_id",
    source: "analytics_events: push_to_substack_success / push_to_substack_blocked",
    note: "Deduped by request_id so spamming the button can't inflate the rate.",
  },
  pro_pushes: {
    definition: "Successful one-click publishes by Pro users.",
    formula: "count of unique request_ids with push_to_substack_success",
    source: "analytics_events: push_to_substack_success",
  },
  blocked_to_upgrade: {
    definition: "Free users who hit the Pro gate AND later completed checkout.",
    formula: "(unique user_ids with push_to_substack_blocked who also fired checkout_completed) ÷ unique blocked users × 100",
    source: "analytics_events",
    note: "Anonymous blocked sessions (no user_id) are excluded from the denominator.",
  },
  push_funnel: {
    definition: "Intent-to-publish funnel for the Substack handoff.",
    formula: "Workspace opened → Copy clicks (surface = workspace_copy) → Push success → Push blocked. Step-over-step % shown next to each row.",
    source: "analytics_events",
    note: "All four steps deduped by request_id — measures intent, not raw clicks.",
  },

  // ---------- Admin Analytics — funnels ----------
  core_funnel: {
    definition: "End-to-end booking-to-draft conversion.",
    formula: "Bar widths are vs. step 1 (Link Clicks = 100%). The small % next to each row is step-over-step (this step ÷ previous step × 100).",
    source: "analytics_events",
    note: "Two denominators on purpose: bar shows top-of-funnel drop-off, inline % shows where the leak happens.",
  },
  monetization_funnel: {
    definition: "From upgrade trigger to paid subscription.",
    formula: "Pro feature blocked (Push) → Upgrade prompt shown → clicked → Checkout started → Checkout completed. Inline % is step-over-step.",
    source: "analytics_events",
  },
  referral_funnel: {
    definition: "Performance of the referral growth loop.",
    formula: "Referral link copied → Referral visit → Signups attributed to source = 'referral'",
    source: "analytics_events + signup_attribution.source",
  },
  invite_funnel: {
    definition: "Performance of the email-invite growth loop.",
    formula: "Invite emails sent → Invite link clicks → Signups attributed to source = 'invite'",
    source: "analytics_events + signup_attribution.source",
  },
  discovery_funnel: {
    definition: "From browsing the Network to sending an invite.",
    formula: "Discovery searches/filters → Profile views → Substack opened → Invite clicks",
    source: "analytics_events",
  },
  signup_attribution: {
    definition: "Where new signups came from.",
    formula: "count by event_data.source ÷ total signup_attribution × 100",
    source: "analytics_events: signup_attribution",
  },
  feature_usage_matrix: {
    definition: "Raw activity per event type for the selected window vs. previous window.",
    formula: "count of events, count of unique user_id per event_type; prev = same length window immediately before",
    source: "analytics_events",
  },
  collab_outcomes: {
    definition: "Status breakdown of recent collab decisions.",
    formula: "Approved / Declined raw counts. Approval Rate = approved ÷ (approved + declined) × 100. Pending = bookings − approved − declined.",
    source: "analytics_events: collab_approved, collab_declined, booking_submitted",
  },
} satisfies Record<string, MetricLegend>;

export type MetricLegendId = keyof typeof LEGENDS;
export const METRIC_LEGENDS: Record<MetricLegendId, MetricLegend> = LEGENDS;
