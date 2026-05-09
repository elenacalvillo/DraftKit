
## Goal

Make the Shared Workspace save flow bulletproof and observable so the "lost hours of work" incident can never repeat silently again. Four coordinated changes:

1. Auto-save every few seconds while typing
2. "Last saved" status indicator
3. Save-failure alerting to `analytics_events`
4. Regression test guarding the guest-side save path

## 1. Auto-save to the database

- Add a debounced auto-save inside `SharedWorkspace.tsx` that fires ~3s after the last keystroke and at most every ~10s while typing continues.
- Auto-save calls the same `save_workspace_content` RPC that manual Save & Sync uses — single code path, single source of truth.
- Skip auto-save when:
  - `editBlockedReason` is set (pre-flight gate failed)
  - the editor is empty
  - content hasn't changed since the last successful save (compare hash)
  - a manual save is already in flight (avoid double writes)
- Auto-save runs silently — no toast on success. Errors flow through the same critical path as manual save (toast + recovery preserved + analytics event), but rate-limited so a broken connection doesn't spam the user.
- localStorage recovery draft continues to write on every keystroke as the last-mile safety net.

## 2. "Last saved" status indicator

- Replace the existing static header area near the Save & Sync button with a small status pill:
  - `Saving…` (in flight, muted spinner)
  - `Saved · 12s ago` (relative time, refreshed every 30s)
  - `Unsaved changes` (dirty + no save in flight yet)
  - `Save failed — retrying` (last save errored, auto-retry pending)
- Drives off the auto-save state machine from #1, so manual and auto saves both feed it.
- On mount, seeds from `content_last_edited_at` so returning users see "Saved · 2h ago" instead of an empty state.

## 3. Save-failure alerting

- On any caught error from `save_workspace_content` (manual or auto), insert one row into `analytics_events`:
  - `event_type = "workspace_save_failed"`
  - `event_data = { request_id, reason, postgres_code, is_auto_save, content_length }`
  - `reason` uses the typed strings already thrown by the RPC: `not_authenticated`, `not_a_participant`, `status_not_approved:<status>`, `request_not_found`, plus a `network_error` bucket for thrown fetch failures.
- Existing `analytics_events` INSERT policy already allows authenticated users to log events with their own `user_id`, so no migration needed.
- Also log a one-shot `workspace_save_recovered` event when a previously-failed dirty buffer succeeds on retry — gives us a recovery rate metric.
- Admin Analytics page (`/admin/analytics`) gets a new tile: "Workspace save failures (7d)" surfacing count + top reason. Lets us notice regressions without waiting for users to scream.

## 4. Regression test for guest-side save

- New Vitest file `src/lib/__tests__/save-workspace.test.ts`.
- Mocks the Supabase client's `rpc("save_workspace_content", ...)` to simulate four scenarios and asserts the client handler reacts correctly:
  1. Success (returns one row) → recovery cleared, success state, no error toast.
  2. RPC throws `not_a_participant` → critical toast, recovery preserved, analytics event fired.
  3. RPC throws `status_not_approved:cancelled` → critical toast with cancelled reason, edit blocked.
  4. Network error → retry queued, dirty state preserved.
- Pure unit test — no live DB. Guards against the silent 0-row regression returning under any future refactor.

## Files in scope

- `src/components/requests/SharedWorkspace.tsx` — auto-save state machine, status pill, error → analytics pipeline.
- `src/components/requests/WorkspaceEditor.tsx` — emit `onContentChange` on every keystroke (already wired) so the parent can debounce.
- `src/hooks/useAnalytics.ts` — add `workspace_save_failed` and `workspace_save_recovered` to `AnalyticsEventType`.
- `src/pages/AdminAnalytics.tsx` — small "Save failures" tile.
- `src/lib/__tests__/save-workspace.test.ts` — new test file.

No database migration required — the RPC, RLS policies, and analytics event table are already in place.

## Validation

- Type continuously for 30s → exactly one auto-save fires per debounce window, status pill cycles `Unsaved → Saving → Saved`.
- Kill network mid-edit → status shows `Save failed — retrying`, recovery draft preserved, one `workspace_save_failed` row in `analytics_events`.
- Restore network → next auto-save succeeds, status returns to `Saved`, one `workspace_save_recovered` row logged.
- Open a `cancelled` collab → no auto-save fires (gate blocks it), status pill hidden.
- Run Vitest → all 4 save-workspace scenarios pass.

