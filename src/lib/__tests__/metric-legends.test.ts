import { describe, it, expect } from "vitest";
import { METRIC_LEGENDS } from "../metric-legends";

/**
 * Guardrail: if a page references a legend id that doesn't exist, the
 * `<MetricInfo />` would silently render nothing. This test pins every
 * id we use today so a rename in metric-legends.ts forces an update at
 * the call site.
 */
const REFERENCED_IDS = [
  // Dashboard
  "ship_rate",
  "published_collabs",
  "time_saved",
  // Admin Analytics — tiles
  "draft_acceptance_rate",
  "ai_attachment_rate",
  "regeneration_rate",
  "guest_conversion",
  "avg_session_duration",
  "booking_conversion",
  "smart_suggestions_used",
  "user_signups",
  "workspace_save_failures",
  // Admin Analytics — Push to Substack
  "push_rate",
  "pro_pushes",
  "blocked_to_upgrade",
  "push_funnel",
  // Admin Analytics — funnels & tables
  "core_funnel",
  "monetization_funnel",
  "referral_funnel",
  "invite_funnel",
  "discovery_funnel",
  "signup_attribution",
  "feature_usage_matrix",
  "collab_outcomes",
] as const;

describe("metric-legends", () => {
  it("has an entry for every referenced metric id", () => {
    for (const id of REFERENCED_IDS) {
      expect(METRIC_LEGENDS, `missing legend for "${id}"`).toHaveProperty(id);
    }
  });

  it("every legend has a definition, formula, and source", () => {
    for (const [id, legend] of Object.entries(METRIC_LEGENDS)) {
      expect(legend.definition, `${id}.definition`).toBeTruthy();
      expect(legend.formula, `${id}.formula`).toBeTruthy();
      expect(legend.source, `${id}.source`).toBeTruthy();
    }
  });

  it("time_saved legend discloses the baseline (not a measured per-user value)", () => {
    const ts = METRIC_LEGENDS.time_saved;
    expect(ts.formula).toMatch(/8\.5/);
    expect(ts.formula).toMatch(/1\.0/);
    expect(ts.note).toBeTruthy();
    expect(ts.note!.toLowerCase()).toMatch(/baseline|measured/);
  });
});
