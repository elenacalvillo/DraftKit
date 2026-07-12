## The problem

Karen's self-assigned chapters don't show up on Dashboard or Collabs until she edits them. That's not a query bug to patch — it's the symptom of a split navigation model:

- **Collabs** (`/dashboard/requests`) = incoming classic guest posts
- **Proposals** (`/dashboard/my-requests`) = outgoing pitches + a "Shared with me" fallback strip for invited chapters
- **Projects** (`/dashboard/projects`) = PRO book outline management

Book chapter workspaces don't fit "incoming" or "outgoing", so they got stitched into Proposals as a secondary section. That's why they're invisible on Dashboard and Collabs, and why we keep patching one pipe at a time.

## The move: unify by intent, not by entity type

Rename and merge Collabs + Proposals into a single **Collaborations** hub that lists every workspace the user participates in, regardless of origin. Keep **Projects** as the PRO umbrella for book-level management. Dashboard pulls from the same unified feed so nothing ever hides.

New sidebar:

```text
Dashboard          → summary + action-required feed
Availability
Collaborations     → every workspace I'm in (was: Collabs + Proposals)
Projects (PRO)     → book outlines & chapter assignment
Network
Settings
Membership
```

## Collaborations page structure

One page, tabbed by *my role in the workspace*, not by entity type:

- **Needs response** — pending incoming requests (host action) + invitations awaiting me (guest action)
- **Active drafts** — every approved workspace I can open: classic collabs, sent proposals that got approved, self-assigned chapters, invited chapters. Book chapters get a `Project · <book title>` badge.
- **Published** — everything shipped
- **Archived** — declined / cancelled

The tab set replaces both current pages. A workspace shows up the instant the row exists — no "edit to activate".

## Data layer: one unified feed

Replace the three separate fetches (host-owned requests, requester-owned requests, collaborator workspaces) with a single Postgres RPC `list_my_workspaces()` that returns every `collab_requests` row where I am:

- host (creator), OR
- requester, OR
- listed in `workspace_collaborators`, OR
- host of the parent project (covers Karen's self-assigned chapters — she's the project owner even when not the requester)

Each row returns: `role_in_workspace` (host | requester | collaborator | project_owner), `is_project_workspace`, `project_id`, `project_title`, `chapter_order`, status, last-edited metadata, and the counterpart's display info. One hook `useMyWorkspaces()` powers Dashboard, Collaborations, and the workspace switcher.

The existing `list_my_collaborator_workspaces` RPC becomes a thin wrapper or is retired.

## Dashboard behaviour

Dashboard's "Recent Collabs" / "Action Required" feed reads from `useMyWorkspaces()` sorted by `content_last_edited_at ?? created_at`. Karen's self-assigned chapter appears immediately on creation because the query no longer requires a shared-content edit or a guest role.

## Projects stays, but narrows

Projects keeps its current job: book-level outline, chapter creation, member management, exports. What it loses is being the *only* place chapters appear — chapters also surface in Collaborations for whoever's writing them (owner or invited guest).

## What we're NOT doing

- Not touching RLS or `has_workspace_access` — the new RPC is `SECURITY DEFINER` and filters by `auth.uid()` exactly like the current one.
- Not migrating data. `collab_requests` schema is unchanged; only the queries and page routing change.
- Not removing Projects. It stays as the PRO umbrella.
- Not changing the Workspace editor itself.

## Rollout

1. **Backend** — new `list_my_workspaces()` RPC + tests.
2. **Hook** — `useMyWorkspaces()` replacing the three current fetches.
3. **Page** — new `/dashboard/collaborations` with the four tabs, built from the unified hook. `SharedWorkspaceCard` becomes the single card component (project badge conditional).
4. **Redirects** — `/dashboard/requests` and `/dashboard/my-requests` 301 to `/dashboard/collaborations?tab=…` so existing emails and bookmarks keep working.
5. **Sidebar** — collapse to the new 7-item nav in `DashboardLayout`.
6. **Dashboard** — swap its feed source to `useMyWorkspaces()`.
7. **Verify** — Playwright smoke test as Karen: create self-assigned chapter → appears on Dashboard and Collaborations immediately, no edit required. As Blessing: invited chapter appears in Collaborations top-level, not buried under Proposals.

## Files touched

- New: `supabase/migrations/<ts>_list_my_workspaces.sql`, `src/hooks/useMyWorkspaces.ts`, `src/pages/Collaborations.tsx`
- Modified: `src/components/layout/DashboardLayout.tsx`, `src/App.tsx` (routes + redirects), `src/pages/Dashboard.tsx`, `src/components/requests/SharedWorkspaceCard.tsx` (generalize), `src/hooks/useCollaboratorWorkspaces.ts` (retire or wrap)
- Deleted after redirects settle: `src/pages/Requests.tsx`, `src/pages/MyRequests.tsx` (kept as thin redirect shells first, removed once analytics confirm no direct traffic)
