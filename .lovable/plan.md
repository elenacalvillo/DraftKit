

## "Time Saved" Collaboration ROI Feature

### What it does
Displays a subtle "time saved" metric on each approved/published RequestCard, showing creators the tangible value DraftKit provided. This becomes a natural Pro conversion trigger.

### How "Time Saved" is calculated

Three heuristic components, computed client-side from tracked data:

1. **SMART Draft savings** (constant: 60 min) -- If a SMART draft was generated, the creator skipped the "blank page" phase. Tracked via a new `first_draft_generated_at` timestamp.

2. **Async collaboration bonus** (constant: 45 min per async handoff) -- If two different people edited (`content_last_edited_by` changes between saves), and the gap between edits is >4 hours, that's a meeting avoided. Tracked via a new `editing_sessions` JSONB array that logs each save with `{edited_by, saved_at, duration_seconds}`.

3. **Active editing time** -- The actual minutes spent writing inside the workspace, summed from `editing_sessions[].duration_seconds`. This is the "proof" number.

**Display formula**: `SMART savings (60) + async handoffs * 45` = "estimated time saved"

### Database changes (1 migration)

Add three columns to `collab_requests`:

```sql
ALTER TABLE collab_requests
  ADD COLUMN IF NOT EXISTS first_draft_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS editing_sessions jsonb DEFAULT '[]'::jsonb;
```

No new RLS policies needed -- existing creator/requester update policies cover these columns.

### File changes

#### 1. `src/components/requests/SharedWorkspace.tsx`
- Track editing session duration: record `editStartTime` in state when user clicks "Edit", compute elapsed seconds on save.
- Append to `editing_sessions` JSONB array on each save: `{edited_by, saved_at, duration_seconds}`.
- Update the save query to also write the new session entry.

#### 2. `src/pages/Workspace.tsx`
- When `generateDraft` succeeds and `first_draft_generated_at` is null, set it to `now()`.
- Pass `editing_sessions` data down to SharedWorkspace if needed.

#### 3. `src/components/requests/RequestCard.tsx`
- When `generateDraft` succeeds and `first_draft_generated_at` is null, set it to `now()`.
- Add a `TimeSavedBadge` inline component that:
  - Checks if `first_draft_generated_at` exists (SMART draft was used).
  - Parses `editing_sessions` to count async handoffs (different `edited_by` values with >4h gap).
  - Computes total: `60 + (handoffs * 45)` minutes.
  - Renders as a small muted row: `⚡ ~2.5 hrs saved` above the CTA button, only for approved/published cards.
- For cards with no data yet, show nothing (no empty state clutter).

#### 4. `src/components/requests/CollabDraftModal.tsx`
- When "Apply to Workspace" writes `shared_content`, also set `first_draft_generated_at` if null.

### UI placement (approved card)

```text
+------------------------------------------+
| [Avatar] Name              [...] [badge] |
|          substack.com/name               |
|                                          |
| Sparkles  Virtual Coffee                 |
| Calendar  Requested: Mon, Mar 3          |
| Mail      Email                          |
|                                          |
| "Their message here..."                  |
|                                          |
| SMART Draft ready (clickable)            |
| External Doc (small link, if set)        |
|                                          |
| ⚡ ~2.5 hrs saved                        |
|                                          |
| [====== Continue Drafting ======]        |
+------------------------------------------+
```

The badge uses the `Zap` icon from lucide in a muted brand color so it doesn't compete with the orange CTA. Only appears when there's actual data to show (at minimum, a SMART draft must have been generated).

### Pro conversion hook (future)
For free-tier users, the badge could show a truncated version: "⚡ Time saved: Upgrade to see" -- but this is **not** part of this initial implementation. Just the tracking and display.

### Technical details

**`editing_sessions` JSONB structure:**
```json
[
  { "edited_by": "Elena", "saved_at": "2026-02-24T10:30:00Z", "duration_seconds": 1800 },
  { "edited_by": "Stefania", "saved_at": "2026-02-25T02:15:00Z", "duration_seconds": 2400 }
]
```

**Async handoff detection** (client-side):
```typescript
// Count transitions where edited_by changes AND time gap > 4 hours
let handoffs = 0;
for (let i = 1; i < sessions.length; i++) {
  if (sessions[i].edited_by !== sessions[i-1].edited_by) {
    const gap = new Date(sessions[i].saved_at) - new Date(sessions[i-1].saved_at);
    if (gap > 4 * 60 * 60 * 1000) handoffs++;
  }
}
```

**Files modified:** 5 total
- `collab_requests` table (migration)
- `src/components/requests/SharedWorkspace.tsx`
- `src/components/requests/RequestCard.tsx`
- `src/components/requests/CollabDraftModal.tsx`
- `src/pages/Workspace.tsx`

