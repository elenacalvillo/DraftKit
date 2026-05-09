## What I found
- I checked the live backend row for the Xian collaboration and the saved workspace content is still an older version last edited by Xian on **Apr 30**.
- That means your newer workspace edits were **not persisted to the backend**. This does not look like a simple rendering issue.
- I also did **not** find evidence of a newer saved version in the current backend logs snapshot, so the save path needs to be hardened.

## Plan
1. **Harden the workspace save flow**
   - Update `SharedWorkspace.tsx` so it only shows success after the backend confirms the write.
   - Immediately re-read the canonical workspace row after save and sync the UI from that result instead of trusting local state.
   - Surface clearer failure states when a collaborator save is rejected or no row is actually updated.

2. **Protect against silent data loss**
   - Add a browser-side recovery draft for the workspace editor keyed by `requestId`.
   - Restore unsynced content on reopen when the local draft is newer than the backend version.
   - Clear the recovery draft only after a confirmed backend save.

3. **Verify collaborator-specific behavior**
   - Audit the invited-collaborator path in `Workspace.tsx` and the shared editor flow to ensure collaborator edits persist exactly like owner/requester edits.
   - Make sure the refreshed workspace state includes the latest `shared_content`, `content_last_edited_at`, and `editing_sessions` after save.

4. **Add regression coverage**
   - Extend targeted tests around workspace persistence so a collaborator edit + reload cannot silently fall back to stale content.
   - Cover the case where the UI should show an error instead of a false “saved” success state.

## Technical details
- Suspected failure zone: the current editor flow updates local UI state optimistically after the `collab_requests` update call, but it does not verify the authoritative row afterward.
- Current risk: a failed or partial collaborator save can leave the user thinking the draft synced when only local in-memory state changed.
- Files I expect to touch:
  - `src/components/requests/SharedWorkspace.tsx`
  - `src/pages/Workspace.tsx`
  - targeted workspace tests

## Expected outcome
- Your workspace will only say it saved when it really saved.
- If the network or access path fails, the app will preserve the unsynced draft locally instead of losing it.
- Invited-collaborator edits will survive refresh/reopen reliably.