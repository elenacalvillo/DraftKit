# Add Collaborator Removal with Confirmation Dialog

## What Changes

### 1. Database: Allow owners to DELETE from `workspace_collaborators`

Currently there's no DELETE policy on `workspace_collaborators`. Add one so the request owner can remove collaborators.

**SQL migration:**

```sql
CREATE POLICY "Owners can remove collaborators"
ON public.workspace_collaborators
FOR DELETE
TO authenticated
USING (is_request_owner(auth.uid(), request_id));
```

### 2. UI: Add "X" button + AlertDialog confirmation (Workspace.tsx)

- Add a small `X` button next to each invited collaborator — **only visible when `isCreator` is true**
- Guests see a clean list with no management controls (invite button is already hidden for guests)
- Clicking `X` opens an `AlertDialog`: *"Remove [Name]? This will immediately revoke their access to this workspace."*
- On confirm: `supabase.from('workspace_collaborators').delete().eq('id', collaboratorId)`, then call `refetchCollaborators()`
- The `has_workspace_access()` function will automatically deny them on next page load

### 3. Guest permissions enforcement

- Verify the Invite button is already hidden for non-creators (it is — line 937 checks `isCreator`)
- Guests see no X buttons, no Invite button — read-only member list

### One "PM" Detail to Watch

When you show the `AlertDialog`, make sure it explicitly mentions the collaborator's name (e.g., "Remove Karen Smiley?"). This prevents the "accident" you were worried about.

Also, once the deletion is successful, make sure Lovable adds a simple toast notification: "Access revoked for [Name]". It gives the owner that final bit of confirmation that the door is locked.

## Files to Change


| File                      | Change                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL migration             | Add DELETE policy for owners on `workspace_collaborators`                                                                                            |
| `src/pages/Workspace.tsx` | Add `handleRemoveCollaborator` function, X button per collaborator (owner-only), AlertDialog confirmation with collaborator name, refetch on success |


## UI Detail

Each collaborator row (lines 1000-1024) gets an X button at the far right, only when `isCreator`:

```text
[Avatar] Karen Smiley  [Joined]  [X]   ← owner sees this
[Avatar] Guest 1       [Pending] [X]   ← owner sees this
[Avatar] Karen Smiley  [Joined]        ← guest sees this (no X)
```

Confirmation dialog uses the existing `AlertDialog` component already imported in the file.