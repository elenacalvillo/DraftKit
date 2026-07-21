## What Karen is seeing

The new **Collaborations** hub (`src/pages/Collaborations.tsx`) renders every workspace — including pending pitches where she is the host — as a single row with only an **Open** button. When she clicks Open, the Workspace page correctly refuses to load ("only approved writers…"). So the host has no path to approve/decline from the new UI.

Root cause: `WorkspaceRow` shows the same "Open" CTA for all statuses. The old `RequestCard` still has Approve/Decline logic, but it isn't wired into the Collaborations page for host + `status === "pending"` rows.

## Fix

Add host-side approve/decline directly into the Collaborations hub, and make the Workspace page gracefully offer approval when a host lands on a still-pending pitch.

### 1. Inline actions on pending host rows (`src/pages/Collaborations.tsx`)

In `WorkspaceRow`, when `w.status === "pending"` AND `w.role_in_workspace === "host"`:

- Replace the single **Open** button with a compact action group: `Approve` (gradient) + `Decline` (outline) + a small overflow to `Open workspace` (preview only).
- Wire the buttons to a new small hook `useRespondToPitch` (or reuse existing mutation logic pulled from `src/pages/Requests.tsx` `handleApprove` / `handleDecline`) that:
  - Updates `collab_requests.status` (+ `approved_at` on approve).
  - Removes the date from `availability.available_dates` on approve; leaves it on decline.
  - Invokes `send-collab-email` with `request_approved` / `request_declined`.
  - Invalidates the `["my_workspaces", userId]` query and `useActiveCollabs` so counts refresh.
- Respect capacity: read `useActiveCollabs().canApprove` and disable Approve with the "Limit Reached" label when false (matches existing `RequestCard` behavior).
- For non-host pending rows (requester side / invited collaborator on a pending pitch) keep the current "Open" behavior — they can't approve.

### 2. Host recovery inside the Workspace page (`src/pages/Workspace.tsx`)

If the host opens a pending workspace today they hit the "only approved writers" block. Add a lightweight branch: when the current user is the host and `status === "pending"`, render an approval prompt card (pitch summary + Approve / Decline buttons) instead of the generic access-denied screen. Same mutation as step 1. Non-hosts keep today's message.

### 3. Small polish

- Move the shared approve/decline logic into `src/lib/collab-actions.ts` (pure functions taking `{ supabase, requestId, creatorId, request }`) so `Requests.tsx`, `Collaborations.tsx`, and `Workspace.tsx` all use the same code path — no drift.
- Update the "Needs response" empty-state copy to hint that pending pitches from other creators land here.

## Out of scope

- No database or RLS changes — RPCs and policies are already correct; this is purely a frontend regression from the hub redesign.
- Email templates unchanged.
- `SharedWorkspaceCard` (project chapters "Shared with me") unchanged — those are never pending pitches.

## Verification

- As host with a pending pitch: open `/dashboard/collaborations?tab=needs_response`, see Approve/Decline inline, click Approve → row moves to Active, guest gets approval email, availability date is removed.
- As host clicking the workspace deep-link on a still-pending pitch: see the new approval prompt instead of "not found".
- As requester viewing their own pending pitch: still sees Open only (no approve button).
- Capacity-limited free user sees "Limit Reached" instead of Approve.
