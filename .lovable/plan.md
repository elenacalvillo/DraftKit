# Chapter content bleed: safe, staged fix

## What we know
- Ch. 2 (Effrosyni) currently holds Dee's title, author and text. Effrosyni's full original (35,318 chars, with comments) is safe in a saved version from Nov 18, 12:17 UTC.
- The chapter editor is not reset when you jump from one chapter to another (no per-chapter identity on the editor). Most likely cause: an unsaved editor buffer from Dee's chapter got saved into Effrosyni's. Inferred from code and timestamps, not proven by logs.
- Writer's Room hides your own name, so Effrosyni doesn't see herself as "Joined" on Dee's chapter even though she is.

## Release order (one step at a time, verify before next)

### Step 1. Audit first, no changes
- Scan every chapter and direct workspace for the same pattern: current content or title matching another workspace the same person edited around the same time.
- Output a list of any other affected chapters. If others exist, we decide together before restoring anything.

### Step 2. Stop new bleeds (code only, no data touched)
- Give the editor a per-chapter identity so it fully resets when switching chapters (prev/next arrows, Shared with me, direct links).
- Save guard: a save is rejected if the editor's loaded chapter id differs from the chapter being saved.
- Flush or discard pending autosave before switching chapters, so nothing in-flight lands in the wrong place.

What could break and how we protect it:
- Unsaved typing when clicking next chapter: we flush the save first, then switch. Tested.
- Live presence and editing sessions: re-join on switch. Tested.
- Version history, inline comments, sticky highlights, reviewer comment-only mode: must still load per chapter. Tested.
- Mobile editing and the copy/Substack push: unchanged path, regression-checked.
- Direct 1:1 collab workspaces use the same editor: tested too.

### Step 3. Restore Effrosyni's chapter
- Before restoring, save the current Ch. 2 state as a new version (so Dee's accidental copy is never lost).
- Restore the Nov 18 12:17 version: content, title, author.
- Confirm Dee's own Ch. 1 is untouched.
- Any comments added to Ch. 2 after 12:17 are listed and shown to you before overwrite.

### Step 4. Writer's Room shows "You"
- Display the current user with a "You" badge instead of hiding them. Visual change only, no permission change.

### Step 5. Verify and communicate
- Sign in as a test chapter writer and reviewer, switch chapters quickly while typing, confirm no bleed.
- Run full test suite and add a test: saving with a mismatched chapter id is rejected.
- Short note for Effrosyni and Karen: chapter restored, comments visible to Dee, why her name didn't show.

## Not changing
- Permissions, emails, roles, publish logic, schedules.

## Technical details
- `Workspace.tsx`: add `key={request.id}` on `<SharedWorkspace>`.
- `SharedWorkspace.tsx`: track `loadedRequestId`; autosave writes `.eq('id', loadedRequestId)` and aborts if it differs from `requestId`; flush debounced save on unmount.
- Restore via a reviewed SQL update from `chapter revisions` row `101af30b-...`, preceded by inserting a snapshot revision of the current state.
- Audit query: compare `shared_content` hashes across workspaces and against latest revisions per workspace.
