
## Fix: Sort Requests by Collaboration Date

### The Problem

In `src/pages/Requests.tsx`, the `fetchRequests` query currently orders results by `created_at` descending — meaning the most *recently submitted* request sits at the top. This causes past collaborations (like the ones with Raghav and James that already happened) to be buried below newer pending requests that were submitted more recently.

```typescript
// Current — orders by when the request was SENT
.order('created_at', { ascending: false });
```

### The Fix

Change the sort to `requested_date` descending, with `created_at` as the tiebreaker for requests that have no scheduled date (e.g. open-ended requests).

```typescript
// Fixed — orders by when the COLLABORATION happens
.order('requested_date', { ascending: false, nullsFirst: false })
.order('created_at', { ascending: false });
```

This means:
- Collaborations with a recent or past date (like Raghav's and James's) float to the top
- Future-dated collaborations are ordered from nearest to furthest
- Requests with no date at all fall to the bottom, ordered by submission time

### Also apply to `MyRequests.tsx` (Guest "Sent Requests" view)

The same ordering issue exists in `src/pages/MyRequests.tsx` — guests viewing their own sent requests also see them ordered by submission date. Same one-line fix applied there for consistency.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Requests.tsx` | Change `.order('created_at', ...)` to `.order('requested_date', ...)` with `created_at` as tiebreaker |
| `src/pages/MyRequests.tsx` | Same ordering fix for the guest-side sent requests view |

No database changes. No edge function changes. No new dependencies.
