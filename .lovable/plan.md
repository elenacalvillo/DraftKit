# Let people leave and clean up workspaces

Dinah's stuck workspace is a real dead end, and I confirmed exactly why by inspecting the record and the access rules.

## What is actually happening

The workspace she linked (`d0454983...`) is a **solo draft owned by Thais Cooke**, not by Dinah, and its status is already `cancelled`. Dinah is listed on it as a `guest` collaborator.

Two confirmed gaps:

1. **No way to leave.** The collaborator table has a delete rule only for the workspace owner ("Owners can remove collaborators"). A collaborator cannot remove their own row, so the workspace stays glued to Dinah's list forever.
2. **No way to delete after cancelling.** The destructive control in the workspace sidebar only renders when the viewer is the owner **and** status is `approved`. Once a workspace is cancelled, even the real owner (Thais) loses the delete option, so the duplicate can never be removed.

## What we build

### 1. Leave workspace (guests, collaborators, reviewers)

- New security-definer function `leave_workspace(request_id)` that removes the caller's own collaborator row and clears their presence/read rows for that workspace.
- Hosts cannot leave their own workspace; they get delete/archive instead.
- If the caller is the pitching guest (requester) rather than an invited collaborator, the workspace is hidden from their list instead of deleted, so the host's copy stays intact.
- UI: "Leave workspace" in the workspace sidebar and in the row menu on the Collaborations list, with a confirm dialog explaining that content stays with the host.

### 2. Owner delete / archive at any status

- Remove the `status === "approved"` restriction on the owner's destructive control so cancelled, declined, and published workspaces can still be cleaned up.
- Owner options by workspace type:
  - Solo draft: "Delete draft" (permanent).
  - Book chapter: "Delete chapter" (existing behaviour).
  - Collab with a partner: "Cancel collab" while active, then "Delete permanently" once cancelled or declined.
- Every destructive path asks for confirmation and states plainly what is lost.

### 3. Duplicate cleanup prompt

- When creating a chapter in a project, or a solo draft, we check existing titles for the same owner. On a match we show an inline notice: "You already have a workspace called X" with an "Open existing" shortcut and the option to create it anyway.
- Light touch only: no automatic merging of content.

## Technical notes

- Migration: `leave_workspace(_request_id uuid)` as `security definer`, scoped strictly to `auth.uid()`; no `USING true` policy widening. Delete on `workspace_collaborators` stays owner-only at the policy level, self-removal happens through the function.
- Also clean `workspace_presence` and `workspace_reads` rows for the leaving user so stale presence avatars disappear.
- Frontend: `src/pages/Workspace.tsx` (sidebar actions), `src/pages/Collaborations.tsx` (row menu), `src/hooks/useWorkspaceCollaborators.ts` (leave mutation + cache invalidation of `my_workspaces`).
- Duplicate check reuses the existing chapter list query for projects, and a lightweight title query for solo drafts.

## Not in this change

Dinah's impact numbers (15 collabs done, 12 lined up, net-new vs repost ratio) are worth a dedicated feature. Happy to plan an "Your DraftKit impact" stats view next if you want it.
