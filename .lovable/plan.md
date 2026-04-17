

## Plan: Surface the Share / Invite Entry Points

The public view link feature shipped, but the modal is unreachable from solo drafts because there's no visible trigger. Fix the UI so hosts can always grab the link.

### Investigation needed first

Let me verify where exactly the invite trigger lives today and what's missing on solo drafts. I'll inspect `Workspace.tsx` and the sidebar render path before finalizing.

### Changes

**1. `src/pages/Workspace.tsx` (header)**
- Add a `Share2` icon button labeled "Share" in the top-right header, next to "Start Writing".
- onClick → opens the existing `InviteCollaboratorModal` (reuse current state).
- Visible for the host on every workspace (solo + collab).

**2. Writer's Room sidebar card (likely in `Workspace.tsx` or a `SharedWorkspace` subcomponent)**
- Restore the "Invite" / "Add collaborator" button inside the WRITER'S ROOM card for solo drafts.
- Currently it appears to render only when collaborators exist or only in non-solo mode — make it always visible to the host.

**3. `src/components/requests/InviteCollaboratorModal.tsx`**
- Already shows the "Public view link" row at the top — confirm it stays as the first visible section on open (no reorder needed if already correct).
- Minor: ensure the link row is visible even before the user types anything in search.

### Files

| File | Change |
|---|---|
| `src/pages/Workspace.tsx` | Add Share button in header; ensure sidebar Invite button always renders for host |
| `src/components/requests/InviteCollaboratorModal.tsx` | Verify public link row renders first (already implemented, confirm only) |

### Out of scope
- Mobile-specific share sheet
- Share button on `RequestCard` (hosts already have it inside the workspace)

