# Fix "Notify" on book chapters: authors' alerts never reach the host

## What happened (confirmed in the data)

Mahelet and StacyLynn really did save their chapters with Notify ticked. Their saves are recorded (Mahelet on Sep 29, StacyLynn on Sep 28 to 30) in Karen's book "Volume 6 - AI Everywhere - How To". But no notification email was ever created for either chapter. Not one "workspace updated" email exists for these chapters, ever.

Why: book chapters are set up with Karen on both sides of the record, and the chapter authors join as invited writers. When an author ticks Notify, the email service checks "is this person the guest of this collab?" The answer is no (Karen is), so it refuses the send. The app fires the email in the background and ignores the refusal, so the author sees "Draft saved & synced" and assumes Karen was told.

This hits every chapter author in every book, not just these two. Messages sent by authors from inside a chapter hit the same wall.

## The fix

1. **Let any confirmed writer on a chapter send Notify and messages.** The email service checks real chapter access (the same access rule the editor already uses) instead of only the original host or guest. Recipients stay the same: Karen plus the other people on that chapter, never the sender.
2. **Comment-only reviewers can still notify.** They have access, so they're included. People with no access are still refused.
3. **No more silent failures.** If the notification can't be sent, the author sees "Saved, but we couldn't notify Karen. Try again." instead of a false success.
4. **Catch Karen up now.** Send Karen one email per affected chapter that has author saves since the bug started, so she knows these chapters are ready. I'll list the exact chapters before sending.

## What you'll see afterwards

- An author ticks Notify, saves, and Karen gets the "chapter updated" email from "<Author> via DraftKit".
- If anything blocks the send, the author sees it right away.

## Technical notes

- `supabase/functions/send-collab-email/index.ts`: in the authorization check, for `workspace_updated_by_guest`, `workspace_updated_by_creator`, `new_message`, `new_message_from_guest`, allow the caller when `has_workspace_access(userId, requestId)` is true (service-role RPC call), in addition to the current creator/requester match. Other email types keep strict roles. Fan-out and sender exclusion are unchanged. Redeploy.
- `src/components/requests/SharedWorkspace.tsx`: await the invoke on Notify, read the error body, and show an error toast on failure. Same treatment for the in-chapter message send.
- Catch-up: query project chapters (`is_project_workspace = true`) with author revisions and no `workspace_updated_*` email in the last 30 days; send one notification per chapter to the host via the fixed function.
- No schema changes.
