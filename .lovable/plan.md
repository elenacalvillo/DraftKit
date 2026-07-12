## Plan

Rewrite `list_my_workspaces()` so **book project chapters** are hidden from Collaborations/Dashboard unless they are actually shared, while every other workspace type (classic guest post Collabs, non-project solo drafts, Proposals) keeps working exactly as today.

### The rule (applied once, globally)

A row is included in the result if:

- `is_project_workspace = false` — always show. Classic Collabs, Proposals, and non-project solo drafts pass through unchanged.
- **OR** `is_project_workspace = true` **AND** at least one of these is true:
  - a row exists in `workspace_collaborators` for this `request_id` where `user_id` is not the current user (a linked collaborator who isn't me), OR
  - a row exists in `workspace_collaborators` for this `request_id` with `user_id IS NULL AND email IS NOT NULL` (a pending email invite — the chapter has been shared out), OR
  - `collab_requests.requester_user_id` is not null and not the current user (someone else is the requester on this chapter).

This closes the requester-branch leak: even if the current user is the requester on their own solo project chapter, that chapter is a project chapter with no external participant, so it's hidden.

### Migration changes to `public.list_my_workspaces()`

1. Remove the per-branch project filtering added last turn on the `host` and `project_owner` arms — that partial fix is what let the `requester` arm leak.
2. Keep the four `UNION` arms (`host`, `requester`, `collaborator`, `project_owner`) simple: each just says "the user matches this role".
3. After the dedupe step, apply the global rule above once in the final `WHERE`, using real subqueries against `workspace_collaborators` and the row's `requester_user_id`.
4. Preserve everything else: return columns, role priority, `ORDER BY` on last edit.

No other function, no schema change, no frontend change. `useMyWorkspaces()`, `Collaborations.tsx`, and Dashboard read from this RPC and will pick up the fix automatically.

### Verification after the migration runs

Using `supabase--read_query` while impersonating your session pattern:

- Count of `is_project_workspace = true` rows returned by `list_my_workspaces()` for Elena should equal only the chapters that have an external collaborator or a non-self requester. Expected: drops from ~200 to a small number.
- Rows with `is_project_workspace = false` returned count should be unchanged (classic Collabs and non-project solo drafts still visible).
- Karen's self-assigned project chapters (project owner + self requester + no invitees) should not appear.
- A test chapter with a pending email invite in `workspace_collaborators` should appear.

### Out of scope

- No changes to Projects pages — solo chapters keep living in `/dashboard/projects/:id`.
- No changes to `list_my_collaborator_workspaces()` or any other RPC.
- No UI copy changes; the Project badge and role badges stay as-is for the chapters that do surface.