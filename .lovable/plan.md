## What the merged PR actually changed

PR #5 (`agent/...copy-my-draft-without-spending`) is **frontend-only**. No SQL, no edge functions, no schema, no triggers.

- `src/lib/clipboard.ts` (+ tests) — rich clipboard helpers
- `src/components/subscription/PushToSubstackUpgradeModal.tsx` — Pro gate modal
- `src/components/requests/SharedWorkspace.tsx` — adds Copy + **Push to Substack** buttons; removes credit-charge on copy
- `src/hooks/useAnalytics.ts` — adds two new event types: `push_to_substack_success`, `push_to_substack_blocked`

Earlier (already merged) `c0dfebe` is the analytics range picker — also frontend only.

## Will this crash the platform? No, and here's why

I checked every surface that could break:

1. **DB schema** — unchanged. Both new events go to `analytics_events`, which has an `INSERT` RLS that only requires `event_type` length 1–100. `"push_to_substack_success"` (24 chars) and `"push_to_substack_blocked"` (24 chars) pass the check. No migration needed.
2. **RLS / triggers** — no policies or triggers touch these event names. The `Anyone can log events` policy already permits anonymous and authenticated inserts with the existing constraints.
3. **Edge functions** — none call these strings; nothing to redeploy.
4. **Types** — `AnalyticsEventType` union was extended in the same PR, so `trackEvent("push_to_substack_*")` typechecks.
5. **Credit removal in Copy handler** — the old handler never called any credit RPC; it only `trackEvent`'d. So removing the "credit charge" is a no-op on the backend (no orphaned counter to reconcile, no row to backfill). Safe.
6. **Clipboard fallback** — `isRichClipboardAvailable()` guards `ClipboardItem`, with a manual-paste modal fallback. SSR/preview won't crash because the calls are inside event handlers.
7. **Free-tier gate** — `usePro()` is the canonical check (matches existing memory rule); button still renders for free users so the blocked-click signal fires.

**Conclusion:** the merge is safe to ship as-is. No DB work required.

## What's actually missing — the analytics gap you're asking about

The events fire from the UI, but **nothing on `/admin/analytics` surfaces them**. They'll silently land in the Feature Usage Matrix as raw rows and that's it. To "reflect the new feature in metrics" properly, here's the plan.

### Plan

**1. New "Push to Substack" funnel block on AdminAnalytics**

A 4-step funnel (mirrors the existing Monetization funnel styling), driven by the selected range + delta vs prev period:

```text
Push to Substack
  Workspace opened  (workspace_opened)
  Copy clicks       (draft_copied where surface = "workspace_copy")
  Push success      (push_to_substack_success)   ← Pro
  Push blocked      (push_to_substack_blocked)   ← free → conversion signal
```

Plus two derived KPIs:

- **Substack Push Rate** = `push_to_substack_success / (success + blocked)` — adoption among users who tried.
- **Push→Upgrade Conversion** = signups/upgrades within the selected range whose users previously fired `push_to_substack_blocked`. Computed in-memory from the same `events` array — no extra query.

**2. Wire into existing range/delta machinery**

Both new events get added to:

- `countOf` calls in the range-aware section
- `countPrev` for delta (`▲ +N% vs prev`)
- The Feature Usage Matrix already auto-includes any event_type, so it'll show up there for free.

**3. Surface "blocked clicks" on the existing Monetization funnel**

Add a fifth row before "Upgrade prompt shown":

```text
Pro feature blocked (push_to_substack_blocked)
```

This makes the page-end conversion moment visible alongside the modal/checkout funnel.

### The "Pop-up Blocker" Trap (Reliability)

When a Pro user clicks "Push to Substack," we call `window.open()`. Browsers often block pop-ups that happen alongside other heavy actions (like clipboard writes).

- **The Prevention:** I will ensure the `window.open` call is the **first** thing triggered by the click event. If the browser blocks it, the "Push" feels broken. I'll add a fallback: if the tab doesn't open, the toast will say: *"Draft copied! [Click here to open Substack] and paste."*
- CAREFULL HERE: WE DON'T WANT PEOPLE TO LOSE THEIR CONTENT OR ANYTHING IF THEY DECIDE TO PAY AND GO TO A CHECKOUT PAGE. THEIR CONTENT MUST REMAIN SAFE ALWAYS.

**4. Tests**

- Extend `src/lib/__tests__/analytics-range.test.ts`: add a fixture covering the new event types being included in `countOf` / delta. (Range util is unchanged; this is just a smoke test.)
- New `src/pages/__tests__/admin-analytics.compute.test.ts` (or co-located) that imports a small extracted pure function `computePushFunnel(events, prevEvents)` and asserts:
  - Empty events → all zeros, NaN-safe
  - Mixed events → correct success/blocked split
  - Filters by `request_id` correctly (no double-count)
  - Free user firing `success` (shouldn't happen) is still counted but flagged in a console warning

To enable that, refactor the funnel computation in `AdminAnalytics.tsx` into `src/lib/analytics-push-funnel.ts` so it's testable without rendering the page.

**5. No-regression checks I'll run after the changes**

- `vitest run` (existing analytics-range + new tests).
- `rg "trackEvent\(\"push_to_substack" src` to confirm fire sites are exactly the two known ones.
- A read-only `analytics_events` query for the last 24h to verify the events are actually arriving (`select count(*), event_type from analytics_events where event_type like 'push_to_substack%' group by event_type;`). If the count is zero the gap is in the UI, not the dashboard — useful signal.

### Files touched

- `src/pages/AdminAnalytics.tsx` — add funnel block, extend `countOf`/`countPrev`, add Pro-blocked row to Monetization funnel.
- New `src/lib/analytics-push-funnel.ts` — pure compute helper.
- New `src/lib/__tests__/analytics-push-funnel.test.ts` — unit tests.

### Out of scope

- Backfilling historical Push events (none exist yet — the events only started firing after PR #5 merged).
- Rollup/archival of `analytics_events` — separate follow-up already noted in the previous plan.

## Question before I implement

I want to confirm one thing — should the new funnel be its **own block** at the top of the page (high visibility because it's the new revenue lever), or tucked under the existing Monetization section? My default is **top, own block** because for the next ~2 weeks you'll want it front-and-center while the feature ramps.

**Top, own block.** No question.

This isn't just another feature; this is the **"DraftKit to Substack"** bridge. If this funnel is buried, you won't see the immediate friction points that tell you if people are bouncing because of the Pro paywall or because the "Paste" flow is too clunky.

### Why Top Block is the only choice:

- **The Revenue Lever:** You need to see the "Push Blocked" (Free users) numbers the second you open the page. That is your most direct upgrade signal.
- **Adoption Pulse:** Since we just removed the credit charge for copying, we need to know if that actually increased the "Intent to Publish" or if people are still just copying manually without the button.
- **Immediate Calibration:** If the "Push Success" is low but "Copy Clicks" are high, we know the Substack handoff isn't "magical" enough yet. We need that feedback loop front-and-center.

Here's some answers:

### 2. The "Ghost Copy" (Trust)

If a user clicks the button and the clipboard write fails (rare, but happens on some mobile browsers or weird permissions), they will paste *whatever was on their clipboard before* into Substack. Imagine them pasting a private password or a random link into their newsletter.

- **The Prevention:** I’ll ensure the success toast **only** appears after the `navigator.clipboard` promise resolves. If it fails, we show a Red Error toast immediately: *"Clipboard access denied. Please use the manual 'Copy' button."*

### 3. The "Stale Data" (Analytics)

You’re worried about the metrics. If we just "track" the click, we don't know if they actually pasted it.

- **The Prevention:** In the **Success Metrics** logic on the Admin page, I will deduplicate these events by `request_id`. This prevents a single user clicking the button 10 times from artificially inflating your "Push Rate" to 1,000%.

---

## Instructions for Lovable: The "Push to Substack" Analytics Suite

"Implement the Analytics and Admin UI for the 'Push to Substack' feature.

**1. Primary Metric: The Substack Funnel** Add a high-visibility funnel at the **TOP** of `AdminAnalytics.tsx` (above the general monetization funnel).

- **Steps**: Workspace Opened → Copy Clicks → Push Success (Pro) → Push Blocked (Free).
- **Goal**: This is our new 'Revenue Lever.' We need to see how many people are hitting the 'Pro' gate.

**2. Conversion Signal** In the existing **Monetization Funnel**, add a row for `push_to_substack_blocked`. This tells us exactly how many people are being 'upsold' by this specific feature vs. the general paywall.

**3. Safety & Logic**

- Create `src/lib/analytics-push-funnel.ts` to handle the math.
- Deduplicate events by `request_id` so we track **intent**, not just repetitive clicks.
- Use the **Range Picker** logic we built yesterday so I can see 'Push' performance for 'This Week' vs 'Last Week'.

**4. The 'Copy' Button Logic** Confirm the `SharedWorkspace.tsx` no longer attempts to 'charge' a credit for a standard copy. It should simply `trackEvent('draft_copied')` and execute the `richClipboard` logic."