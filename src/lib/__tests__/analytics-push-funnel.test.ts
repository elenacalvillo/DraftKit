import { describe, it, expect } from "vitest";
import { computePushFunnel, pushFunnelSteps, type AnalyticsEventLike } from "../analytics-push-funnel";

const ev = (
  event_type: string,
  request_id?: string,
  user_id?: string,
  surface?: string,
): AnalyticsEventLike => ({
  event_type,
  event_data: { ...(request_id ? { request_id } : {}), ...(surface ? { surface } : {}) },
  user_id: user_id ?? null,
  id: Math.random().toString(36).slice(2),
});

describe("computePushFunnel", () => {
  it("returns NaN-safe zeros for empty input", () => {
    const f = computePushFunnel([]);
    expect(f).toEqual({
      workspaceOpened: 0,
      copyClicks: 0,
      pushSuccess: 0,
      pushBlocked: 0,
      pushRate: 0,
      blockedToUpgradeConversion: 0,
    });
  });

  it("dedupes by request_id (10 clicks on the same draft = 1 intent)", () => {
    const spam: AnalyticsEventLike[] = Array.from({ length: 10 }, () =>
      ev("push_to_substack_success", "req-A", "user-1"),
    );
    const f = computePushFunnel(spam);
    expect(f.pushSuccess).toBe(1);
    expect(f.pushRate).toBe(100);
  });

  it("counts copy clicks only when surface = workspace_copy", () => {
    const events = [
      ev("draft_copied", "req-A", "u1", "workspace_copy"),
      ev("draft_copied", "req-B", "u1", "some_other_surface"),
      ev("draft_copied", "req-C", "u1"), // no surface
    ];
    expect(computePushFunnel(events).copyClicks).toBe(1);
  });

  it("computes push rate from success/blocked split", () => {
    const events = [
      ev("push_to_substack_success", "r1", "u1"),
      ev("push_to_substack_success", "r2", "u2"),
      ev("push_to_substack_blocked", "r3", "u3"),
      ev("push_to_substack_blocked", "r4", "u4"),
    ];
    const f = computePushFunnel(events);
    expect(f.pushSuccess).toBe(2);
    expect(f.pushBlocked).toBe(2);
    expect(f.pushRate).toBe(50);
  });

  it("computes blocked → upgrade conversion", () => {
    const events = [
      ev("push_to_substack_blocked", "r1", "u1"),
      ev("push_to_substack_blocked", "r2", "u2"),
      ev("push_to_substack_blocked", "r3", "u3"),
      ev("checkout_completed", undefined, "u1"),
      ev("checkout_completed", undefined, "u3"),
    ];
    const f = computePushFunnel(events);
    expect(f.blockedToUpgradeConversion).toBeCloseTo((2 / 3) * 100, 1);
  });

  it("does not count anonymous blocked users in conversion (no user_id)", () => {
    const events = [
      ev("push_to_substack_blocked", "r1"), // no user_id
      ev("checkout_completed", undefined, "someone-else"),
    ];
    expect(computePushFunnel(events).blockedToUpgradeConversion).toBe(0);
  });

  it("pushFunnelSteps returns four ordered steps", () => {
    const steps = pushFunnelSteps(computePushFunnel([]));
    expect(steps).toHaveLength(4);
    expect(steps[0].name).toMatch(/Workspace/);
    expect(steps[3].name).toMatch(/Free/);
  });
});
