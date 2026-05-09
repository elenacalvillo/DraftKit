/**
 * Push to Substack funnel compute helpers.
 *
 * Pure functions extracted from AdminAnalytics.tsx so they can be unit
 * tested without rendering the page. The funnel measures the new revenue
 * lever introduced by PR #5: Free users see the Push button, hit the Pro
 * gate, and (we hope) upgrade.
 *
 * IMPORTANT — dedupe by request_id: a single user clicking the button 10
 * times must not inflate the success count to 1000%. We measure INTENT
 * (one user → one collab → one event), not raw clicks.
 */

export interface AnalyticsEventLike {
  event_type: string;
  event_data?: unknown;
  user_id?: string | null;
  id?: string;
}

interface EventDataShape {
  request_id?: string;
  surface?: string;
  [k: string]: unknown;
}

function readData(e: AnalyticsEventLike): EventDataShape {
  if (e.event_data && typeof e.event_data === "object") return e.event_data as EventDataShape;
  return {};
}

/** Count unique request_ids; if request_id is missing, fall back to event id
 * so we don't drop the data point — we just can't dedupe it. */
function uniqueByRequest(events: AnalyticsEventLike[], type: string, surfaceFilter?: string): number {
  const seen = new Set<string>();
  for (const e of events) {
    if (e.event_type !== type) continue;
    const d = readData(e);
    if (surfaceFilter && d.surface !== surfaceFilter) continue;
    const key = d.request_id ?? `__no_req_${e.id ?? Math.random()}`;
    seen.add(key);
  }
  return seen.size;
}

export interface PushFunnel {
  workspaceOpened: number;
  copyClicks: number;
  pushSuccess: number;
  pushBlocked: number;
  /** push_success / (success + blocked) — adoption among users who tried. */
  pushRate: number;
  /** Of users who hit `push_to_substack_blocked`, how many later
   * `checkout_completed`'d in the same window. Approximates "Push → Upgrade
   * Conversion" without an extra query. */
  blockedToUpgradeConversion: number;
}

export function computePushFunnel(events: AnalyticsEventLike[]): PushFunnel {
  const workspaceOpened = uniqueByRequest(events, "workspace_opened");
  const copyClicks = uniqueByRequest(events, "draft_copied", "workspace_copy");
  const pushSuccess = uniqueByRequest(events, "push_to_substack_success");
  const pushBlocked = uniqueByRequest(events, "push_to_substack_blocked");

  const tried = pushSuccess + pushBlocked;
  const pushRate = tried > 0 ? (pushSuccess / tried) * 100 : 0;

  // Users who hit the blocked gate
  const blockedUsers = new Set<string>();
  for (const e of events) {
    if (e.event_type !== "push_to_substack_blocked") continue;
    if (e.user_id) blockedUsers.add(e.user_id);
  }
  // Of those, how many later checked out
  let converted = 0;
  for (const uid of blockedUsers) {
    const didCheckout = events.some(
      (e) => e.event_type === "checkout_completed" && e.user_id === uid,
    );
    if (didCheckout) converted += 1;
  }
  const blockedToUpgradeConversion = blockedUsers.size > 0 ? (converted / blockedUsers.size) * 100 : 0;

  return { workspaceOpened, copyClicks, pushSuccess, pushBlocked, pushRate, blockedToUpgradeConversion };
}

/** Step rows for rendering the funnel block. */
export function pushFunnelSteps(f: PushFunnel): Array<{ name: string; count: number }> {
  return [
    { name: "Workspace opened", count: f.workspaceOpened },
    { name: "Copy clicks", count: f.copyClicks },
    { name: "Push success (Pro)", count: f.pushSuccess },
    { name: "Push blocked (Free → upsell)", count: f.pushBlocked },
  ];
}
