# Pre-acceptance pitch context and messaging

Dinah's two gaps: the guest's pitch note only lives in email, and there is no way to talk before Accept or Decline. Most of this is now built and QA-verified on the sandbox accounts. What remains is the email side of a pending thread, plus cleanup of the temporary test data.

## Already built and verified this session

- The guest's full pitch note renders inside the pending card on the host's Collaborations screen, clamped to three lines with Show more / Show less so nothing is cut off.
- A pitch thread dialog on pending items: host sees a Message button next to Approve and Decline; guest sees Messages with an unread count.
- Verified with the isolated sandbox accounts, no production data touched:
  - Host sees the entire 400+ character pitch, expands and collapses correctly.
  - Host sends a reply while status is still Pending.
  - Guest sees that reply and answers back before any decision.

## Remaining work

### 1. Fix the notification direction on pending threads

The thread currently always fires the `new_message` email type, which addresses the guest. When the guest is the sender, the host gets nothing and the guest gets an email about their own message. Send `new_message_from_guest` when the sender is the guest, `new_message` when the sender is the host.

### 2. Point pending-thread emails at the right screen

Both message emails link to the workspace, which does not exist yet while the collab is pending. For pending requests the button should link to the Collaborations hub with the row highlighted, and read "Open in DraftKit" instead of "Open Workspace & Reply". Approved collabs keep the existing workspace link.

### 3. Pitch context in the notification email

Include a short reminder of what the collab is about in the pending-thread email so the recipient has context without opening the app.

### 4. Clean up the test data (no browser runs)

No Playwright passes, headless browser runs, or automated UI re-runs. Verification is a code read plus the edge function deploy log, then you inspect it yourself in the app.

- Delete the temporary QA project, its chapters, the seeded pitch, the two dummy creator profiles, and the temporary admin and Project-tier grants given to the test owner during setup. Scoped deletes by ID only, nothing in production is touched.

## Technical notes

- `src/components/requests/PitchThreadDialog.tsx`: pick the email type from `isHost` rather than hardcoding `new_message`; pass a flag marking the request as pending.
- `supabase/functions/send-collab-email/index.ts`: in the `new_message` and `new_message_from_guest` branches, swap the CTA target to `/dashboard/collaborations?highlight=<requestId>` when the request status is `pending`, and add the pitch excerpt block. Redeploy the function.
- No schema change needed. `collaboration_messages` RLS already lets both host and requester read and insert while pending, which the sandbox run confirmed.
- Cleanup runs against sandbox IDs only: project `QA Sandbox Volume`, the seeded pitch, and the two `@draftkit.app` test users.
