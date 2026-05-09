## Goal
Make workspace edits recoverable on this device, make save status truthful, and ensure sending messages cannot wipe unsaved editor state.

## Plan
1. **Tighten local recovery in `SharedWorkspace`**
   - Save the current editor HTML to browser local storage on every content change, keyed by the workspace/request ID.
   - On workspace load, compare the local draft against the canonical backend version and show a recovery banner with **Restore** and **Ignore** when the local draft is newer or different.
   - Keep the local draft until a verified backend save succeeds; never clear it on optimistic UI updates.

2. **Make save confirmation strict and explicit**
   - Update the workspace save flow so success is only shown when the backend confirms exactly **1** row was written for that request.
   - If the save affects **0 rows**, show the explicit critical failure toast and preserve the local recovery draft.
   - Re-sync the UI from the backend-confirmed row after save so the editor reflects the authoritative stored version, not just the in-memory value.

3. **Isolate messaging from editor state in `Workspace.tsx`**
   - Audit the message modal open/close and refresh flow so it cannot remount or reset the shared workspace editor while the user has unsaved changes.
   - Keep message refresh state scoped to the conversation panel/modal instead of anything that could recreate the workspace editor tree.
   - Verify the message modal callback only refreshes messaging surfaces and does not touch `request.shared_content` or other editor-owned state.

4. **Protect the recovery UX against false matches**
   - Only suppress the restore banner when the local and backend content truly match, or when the backend version is clearly newer.
   - Make the banner copy unambiguous so users know the local draft lives on that browser/device until a confirmed save.

5. **Regression validation**
   - Test these flows specifically:
     - type without saving -> reload -> restore banner appears
     - save succeeds -> recovery draft is cleared
     - save affects 0 rows -> critical error toast appears and local draft remains
     - send a message while the workspace is open -> editor content and edit mode remain intact

## Files in scope
- `src/components/requests/SharedWorkspace.tsx`
- `src/pages/Workspace.tsx`
- Any narrowly targeted workspace regression test file if one exists or needs to be added

## Technical details
- Use a deterministic key such as `draftkit_recovery_${requestId}`.
- Treat the backend row as canonical only after the update/select confirms one matching row.
- Avoid coupling message modal state changes to props/keys that would recreate `<SharedWorkspace />`.
- Preserve the existing design system and toast stack while changing only the persistence behavior you requested.