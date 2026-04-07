

# Writer's Room: Multi-Collaborator Workspaces — Feasibility & Architecture

## Your PM Thinking: Assessment

Your instincts are correct on every major point. The "acceptance triggers workspace" gate, the email-tied invite loop, and the "human notification instead of real-time sync" approach are all pragmatic, cost-effective decisions. Here's the full breakdown.

## Cost Analysis: What's Cheap vs. What's Expensive

### Cheap (days, not weeks)

| Piece | Why it's cheap |
|-------|---------------|
| `workspace_collaborators` table | Simple join table: `request_id`, `user_id`, `email`, `role`, `invited_at` |
| "Add to Writer's Room" button + modal | Small UI component, email input, submit |
| Invite email via existing `send-collab-email` | Reuse the edge function you already have |
| Email-to-account linking on signup | You already have `link_requests_to_new_user` trigger — same pattern |
| Collaborator list in sidebar | Query the new table, render avatars |
| Credit deduction on invite | One `UPDATE creators SET credits = credits - 1` call |

### Medium (the presence indicator)

The "Elena is still editing" banner is the smartest part of your plan and is surprisingly affordable because you are NOT building Google Docs. Here's the approach:

**How it works without Supabase Realtime channels:**
- When a user clicks "Edit Draft," write a row to a `workspace_presence` table: `{ request_id, user_id, user_name, last_active_at }`.
- Every 30 seconds while editing, update `last_active_at` (a simple heartbeat).
- When another user opens the workspace, query: "Is anyone active in the last 60 seconds?"
- If yes, show the yellow banner: *"Elena is currently drafting. Wait for her to save or reach out before editing."*
- Optional: make the editor read-only while someone else is active, with a "Break Lock" button.

**Cost: ~$0/month extra.** It's just a small table with a periodic UPDATE. No WebSocket channels, no Realtime subscription needed. The "polling" approach (check on page load + every 30s) is sufficient because your editing sessions are measured in minutes, not milliseconds.

### Expensive (what to avoid)

| Piece | Why it's expensive | Recommendation |
|-------|-------------------|----------------|
| Real-time cursors (Google Docs style) | Requires Yjs/CRDT + WebSocket server | Skip entirely — your async model is the product differentiator |
| Per-keystroke sync | Would need Supabase Realtime + conflict resolution | Skip — "Save & Sync" is the correct UX |

## The Constraints You Should Know

### 1. RLS Complexity (Medium risk)
Currently, workspace access is binary: you're the creator OR the requester. Adding a third role ("invited collaborator") means every RLS policy on `collab_requests` and `collaboration_messages` needs a new check: "OR this user is in `workspace_collaborators` for this request." This is doable but must be done carefully to avoid security holes.

### 2. Who Pays? (Your instinct is right)
Only the workspace Owner (the creator who accepted the request) should see the "Add to Writer's Room" button. Guests should never be able to invite others or spend someone else's credits. This is a simple UI check + an RLS policy on the collaborators table.

### 3. Scope Isolation (Low risk)
Invited collaborators must only see that ONE workspace. This is naturally enforced by the `workspace_collaborators` table — you query "show me workspaces where I'm a collaborator" and only those rows come back. No risk of dashboard leakage.

### 4. The "Break Lock" Edge Case
If Elena leaves her laptop open and goes to lunch, the heartbeat stops after 60 seconds and the lock auto-releases. If she comes back and types, the lock re-engages. The only risk is the 60-second window where two people could overlap — but since you already have "Save & Sync" as the explicit action, the worst case is a toast saying "Elena saved while you were editing. Your changes may conflict."

## Implementation Plan (Incremental, Foundation First)

### Phase 1: Database Foundation

**Migration 1 — `workspace_collaborators` table:**
```text
request_id  UUID  (FK to collab_requests)
user_id     UUID  (nullable — filled when they sign up)
email       TEXT  (the invite target)
role        TEXT  (default 'guest')
invited_by  UUID  (the owner who invited)
invited_at  TIMESTAMPTZ
joined_at   TIMESTAMPTZ (null until they access the workspace)
```
Plus RLS: owners can INSERT/SELECT, collaborators can SELECT their own rows.

**Migration 2 — `workspace_presence` table:**
```text
request_id    UUID
user_id       UUID
user_name     TEXT
last_active_at TIMESTAMPTZ
has_unsaved    BOOLEAN (default false)
```
Plus RLS: anyone with workspace access can SELECT/UPSERT.

### Phase 2: Invite Flow (UI)

- Add "Add to Writer's Room" button in Workspace sidebar (visible to owner only, Pro or credits > 0).
- Modal: email input, optional message, "Invite" button.
- On submit: deduct 1 credit, insert into `workspace_collaborators`, fire `send-collab-email` with a new `type: 'workspace_invite'`.
- The invite email contains a unique link: `/dashboard/workspace/{requestId}?invite={email}`.

### Phase 3: Join Flow

- When an invited user (existing account) navigates to the workspace, the system checks `workspace_collaborators` for their email/user_id and grants access.
- When a new user signs up with the invited email, the existing `link_requests_to_new_user` pattern is extended to also update `workspace_collaborators.user_id`.
- Collaborator list renders in the sidebar showing all participants + their role.

### Phase 4: Presence Indicator

- On "Edit Draft" click: UPSERT into `workspace_presence`.
- Heartbeat: every 30s while editing, update `last_active_at`.
- On workspace load: query presence. If someone is active (last 60s), show yellow banner.
- Optional read-only lock with "Break Lock" button.

### Phase 5: Update RLS Policies

- Extend `collab_requests` SELECT policies to include users in `workspace_collaborators`.
- Extend `collaboration_messages` policies similarly.
- Extend `SharedWorkspace` edit policies for collaborators.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL (1) | Create `workspace_collaborators` table with RLS |
| Migration SQL (2) | Create `workspace_presence` table with RLS |
| `src/pages/Workspace.tsx` | Add invite button, collaborator list in sidebar, presence banner |
| `src/components/requests/SharedWorkspace.tsx` | Add presence heartbeat on edit, check presence on load |
| `src/components/requests/InviteCollaboratorModal.tsx` | New: email input modal for inviting writers |
| `supabase/functions/send-collab-email/index.ts` | Add `workspace_invite` email template |
| RLS migration | Extend collab_requests + collaboration_messages policies for collaborators |

## Summary

Total estimated cost: **$0/month incremental infrastructure**. The presence system uses simple database polling, not WebSockets. The invite system reuses your existing email function. The credit deduction reuses your existing credits column. The hardest part is the RLS policy updates — roughly 6-8 policies to extend — but it's mechanical work, not architectural risk.

