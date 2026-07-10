# Ship Rate = closed loops only

The Dashboard "Ship Rate" tile currently penalizes active users who have lots of approved collabs still moving through the pipeline. That is the bug the user (correctly) flagged.

## Current formula (in `src/pages/Dashboard.tsx`)

```text
eligible   = requests where status ≠ pending AND status ≠ cancelled
ship_rate  = published ÷ eligible × 100
```

So `approved` (in-progress drafts) sits in the denominator. Someone with 11 approved + 11 published = 50%, even though every finished collab shipped.

## New formula

Only count **closed loops** — collabs that reached a terminal state — in the denominator:

```text
closed     = requests where status IN ('published', 'declined', 'cancelled')
ship_rate  = published ÷ closed × 100
```

Pending, approved, and any other in-flight statuses are excluded until they land somewhere. This matches how a healthy pipeline should read: shipping 11/11 finished = 100%, even with 11 more in progress.

## Changes

- `src/pages/Dashboard.tsx`
  - Replace the `eligibleRequests` calc with `closedRequests` filter as above.
  - Update `shipRate` to divide by `closedRequests.length`.
  - Keep the `"—"` empty state when there are no closed collabs yet (the empty tip already says "Approve and publish your first collab…" — we'll tweak it to "Publish or close your first collab to start tracking your ship rate").
  - Keep the `subLabel` copy but nudge it from "Requests turned into published work" → "Share of finished collabs you published" so it matches the new math.

- `src/lib/metric-legends.ts`
  - Update `ship_rate.definition` and `ship_rate.formula` to reflect the closed-loop math, so the hover tooltip stays truthful.

No schema, RLS, or backend changes. No changes to `Published Collabs` or `Time Saved` tiles — those already only look at `status = 'published'`.

## Non-goals

- Not touching in-progress views or any status transitions.
- Not adding new tiles (e.g. "in progress"). That's a separate design change.
- Not emailing the user back — this is a code fix only.
