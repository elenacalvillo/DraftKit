

# "Start Writing" — Solo-to-Collab Workspaces

## The Idea

You're right — this is a pivotal shift. Right now DraftKit forces a linear flow: someone sends a proposal → you accept → date is set → workspace opens. But real collaboration often starts with "let me draft something first." The "Start Writing" feature lets you create a workspace immediately, write solo, and invite collaborators whenever you're ready.

## How It Works (User Perspective)

1. **Dashboard**: A prominent "Start Writing" button appears at the top, with helper text: *"Start your draft now. Invite collaborators whenever you're ready."*
2. **Click it**: A lightweight modal asks for a **Project Title** only (e.g., "AI Everywhere Interview with Farida")
3. **Workspace opens**: You land in the same Zen editor you already know — solo. The Writer's Room sidebar shows just you.
4. **Invite when ready**: The existing "Invite" button in the sidebar lets you search for DraftKit users or invite by email. The workspace transitions from solo to collaborative seamlessly.

## Architecture Approach

This reuses the existing `collab_requests` table with minimal changes:

**New column**: `is_solo` (boolean, default `false`) — marks self-initiated workspaces so we can distinguish them from incoming proposals. No schema break.

**Creation logic**: When "Start Writing" is clicked, insert a `collab_request` where:
- `creator_id` = your creator ID
- `requester_name` = your own name (you're both host and initial writer)
- `requester_email` = your email
- `requester_user_id` = your user ID
- `status` = `'approved'` (skip pending — it's your own workspace)
- `requested_date` = `null` (no date needed)
- `is_solo` = `true`
- `message` = the project title

**Workspace.tsx**: Already handles all the cases — `isCreator` will be true, the invite flow works, the editor works. We just need to adjust a few UI labels for solo workspaces (e.g., hide "Requester" section when it's yourself, show "Project Title" instead of requester name in the sidebar header).

**Credits**: Deduct 1 collaboration slot on creation, same as a standard approval. Pro users are unlimited.

## Database Migration

```sql
ALTER TABLE public.collab_requests
ADD COLUMN is_solo boolean NOT NULL DEFAULT false;
```

No new RLS policies needed — the existing "creators can insert/update/view own requests" policies cover this since you're the creator.

## Files to Change

| File | Change |
|------|--------|
| SQL migration | Add `is_solo` boolean column to `collab_requests` |
| `src/pages/Dashboard.tsx` | Add "Start Writing" button + simple title modal at the top |
| `src/pages/Workspace.tsx` | Adjust sidebar labels for solo workspaces (hide requester info when `is_solo` and requester is self, show project title) |
| `src/pages/Requests.tsx` | Show solo workspaces in the "Approved" tab with a distinguishing label like "Solo Draft" |
| `src/pages/MyRequests.tsx` | Filter out solo workspaces from "My Proposals" (they're not proposals — they show under Collabs) |

## What We Don't Change

- No new tables or schemas
- No changes to `has_workspace_access()` or RLS policies
- No changes to the invite flow — it already works from inside any workspace
- No changes to the credit system logic — same deduction path
- The editor, presence system, and Writer's Room sidebar all work as-is

## Dashboard Button Placement

```text
┌─────────────────────────────────────────────┐
│ Welcome back, Elena                          │
│ Here's what's happening with your collabs    │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  ✏️  Start Writing                    │   │
│  │  Start your draft now. Invite         │   │
│  │  collaborators whenever you're ready. │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Your Public Booking Link card]             │
│  ...                                         │
└─────────────────────────────────────────────┘
```

