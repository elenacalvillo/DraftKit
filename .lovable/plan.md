# Fix chapter content bleed (focused)

## Scope
Only the issue Effrosyni reported. No audit of other chapters, no re-testing of features that already work.

## 1. Stop it happening again
- The chapter editor fully resets when you move to a different chapter, so one chapter's text can't be saved into another.
- Small safety check: a save is refused if it is aimed at a different chapter than the one that was loaded.
- Any typing not yet saved is saved to the correct chapter before switching.

Why this is low risk: it only changes what happens at the moment you switch chapters. Editing, comments, history, copy/push and permissions stay as they are.

## 2. Restore Effrosyni's chapter
- First save Ch. 2's current state as a version, so nothing is lost.
- Restore her Nov 18, 12:17 UTC version (title, author, text, comments).
- Dee's Ch. 1 is not touched.

## 3. Show "You" in Writer's Room
- Show the current person with a "You" badge instead of hiding them. Display only.

## Check (one pass)
- One test: a save aimed at the wrong chapter is refused.
- One quick check: switch chapters while typing and confirm the text stays where it belongs.

## Technical details
- `Workspace.tsx`: add `key={request.id}` to `<SharedWorkspace>`.
- `SharedWorkspace.tsx`: autosave aborts if the loaded id differs from `requestId`; flush pending save on unmount.
- Restore with a single reviewed update from revision `101af30b-...`, after inserting a snapshot revision.
