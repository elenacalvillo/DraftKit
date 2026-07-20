# Collaborators can't open pitched workspaces — plan

## What the users are hitting

Verified in the database: `collab_requests` currently has SELECT policies for only two audiences —

- `Creators view own requests` → the host (creator_id)
- `Requesters can view their own requests` → the pitcher (requester_user_id)

There is **no SELECT policy for invited collaborators** listed in `workspace_collaborators`. The recent security pass added an UPDATE policy for them ("Collaborators can edit shared workspace content") but never restored the matching SELECT policy.

Effect: when Karen invites a third person (or when a co-writer is invited to a project workspace) that person can see the row in the Collaborations hub (because `list_my_collaborator_workspaces` is SECURITY DEFINER and bypasses RLS), but the moment they click into `/workspace/:id`, `Workspace.tsx` runs `supabase.from("collab_requests").select(...)` directly — RLS returns 0 rows — and the page shows "workspace not found / access denied". That matches the "hard time accessing pitched collaborations" report.

Pitchers themselves are still fine (their own SELECT policy is intact). The regression is scoped to invited collaborators and project members who reach a workspace through an invite rather than by being the host or the original requester.

## Fix

Add one focused SELECT policy on `collab_requests`, mirroring the existing UPDATE policy for collaborators, plus the equivalent for project members so project-workspace invitees don't hit the same wall.

New migration:

```sql
-- Invited workspace collaborators can read the collab_request they were added to
CREATE POLICY "Collaborators can view shared workspaces"
ON public.collab_requests
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT wc.request_id
    FROM public.workspace_collaborators wc
    WHERE wc.user_id = auth.uid()
  )
);

-- Project members can read every chapter workspace inside their project
CREATE POLICY "Project members can view project workspaces"
ON public.collab_requests
FOR SELECT
TO authenticated
USING (
  is_project_workspace = true
  AND project_id IS NOT NULL
  AND project_id IN (
    SELECT pm.project_id
    FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
  )
);
```

Both policies are read-only, scoped by explicit `auth.uid()` membership rows, and cannot leak requests outside the caller's own invites (they satisfy the Realtime Isolation rule — no `USING true`).

No GRANT changes needed; `collab_requests` already grants SELECT to `authenticated`.

## Verification

1. Migration applies cleanly (`supabase--migration`).
2. `pg_policies` shows the two new SELECT policies alongside the existing ones.
3. Regression: as a signed-in collaborator (not host, not requester), `select id from collab_requests where id = <shared workspace id>` returns the row. As a random signed-in user with no membership, it still returns nothing.
4. Manually load `/workspace/:id` in the preview as an invited collaborator — page renders instead of the "not found" state.
5. Add a small SQL regression test asserting each new policy's `USING` clause exists, so a future security pass can't silently remove it again.

## Out of scope

- No changes to write paths, edge functions, or the `has_workspace_access` helper.
- No changes to the requester/host SELECT policies.
- Public/anonymous access is untouched — both new policies are `TO authenticated`.
