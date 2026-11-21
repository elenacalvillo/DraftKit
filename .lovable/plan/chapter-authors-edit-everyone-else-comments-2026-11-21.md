# Chapter authors edit, everyone else comments

## What was checked in the live data
- All 387 book chapters store Karen's account as the chapter's writer. That record can't be used to find the real author (the same caveat from your notes).
- In the 43 chapters with invited people, the **first person invited** is always the real author (Mahelet, Effrosyni, Patricia, and others). Peer reviewers were added later (Dee into Effrosyni's chapter on Nov 18, Effrosyni into Daria's, StacyLynn into Monashree's, and so on).
- Hollie is already a Cross-chapter Reviewer on Volumes 5 to 7, so she is comment-only today. This change won't affect her.

## The rule (book chapters only)
Full editing on a chapter:
1. Book owner (Karen)
2. Book Admins
3. The chapter's author, meaning the first person invited into that chapter

Everyone else who opens the chapter gets comment-only mode automatically. That includes peer reviewers invited through the Writer's Room and project Chapter Writers viewing other people's chapters.

Direct Collabs and solo drafts don't change at all.

## Who notices a difference
- Authors in their own chapter: no change.
- Karen and Admins: no change.
- People invited later to review a peer's chapter: they now see the existing comment-only view instead of the editor. This is the fix Karen asked for.
- No invite buttons, role menus, or new screens.

## Comment popover
When someone highlights text, a small "Comment" button pops up just above the selection. Comment-only reviewers will see it too, so they no longer have to find the bottom toolbar. The bottom toolbar button stays, so people who already learned it aren't thrown off.

## Out of scope
Private DMs, custom workflow stages, a reviewer picker on the book page.

## Release safety
- Authors are worked out automatically each time a chapter opens. No existing data is rewritten, so nothing needs to be migrated or undone.
- The rule is enforced in two places: the screen (comment-only view) and the server (saves from non-editors are rejected). Comments still save as before.
- Before shipping, the 43 affected chapters are listed once to confirm each author still edits and each reviewer is comment-only. A copy goes to your Files so you can see exactly who changed.
- Checks are limited to this change. Nothing that already works gets retested.

## Technical details
- Extend `is_comment_only_reviewer(_user_id, _request_id)`: for `is_project_workspace` chapters, return true when the user is not the owner (`project_role` = owner/admin per AGENTS.md) and is not the earliest-`invited_at` row in `workspace_collaborators` (excluding the owner's own user_id). Keep the existing peer/cross-reviewer clause.
- `save_workspace_content` and the comment save path already branch on this function. The comment-only path keeps allowing comment-mark-only diffs via `_normalize_for_comment_diff`. Confirm the frontend reads the same flag in `Workspace.tsx` / `projectCapabilities()` so the UI and server stay aligned.
- Add a selection bubble (Tiptap BubbleMenu) in the workspace editor that opens the existing comment action. Render it in comment-only mode too.
- Add unit tests in `src/lib/access` for the rule: author edits, later invitee is comment-only, owner/admin edit, direct collabs unaffected.
- Update the AGENTS.md rule: chapter author = first invited collaborator.
