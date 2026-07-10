## Diagnosis

Karen's book-project workspaces are created as **solo** requests: `creator_id === requester_user_id` (both are Karen). Blessing is attached via `workspace_collaborators`, not as the `requester`.

The messaging pipeline was built for the classic 2-party model (host ↔ guest) and never learned about `workspace_collaborators`:

1. `SendMessageModal` (host view) writes the message with `sender_type='creator'`, then calls `send-collab-email` with `type: 'new_message'`.
2. `send-collab-email` hard-codes the recipient for `new_message` to `request.requester_email` — which on a solo/project workspace **is Karen's own email**.
3. Result: Karen sends → Karen receives. Blessing (the actual collaborator) is never notified. From Karen's inbox it looks "backwards" because every message she sends comes back to her.

The same shape breaks the reverse path when Blessing (collaborator, not requester) sends: `GuestMessageModal` writes `sender_type='requester'`, and `new_message_from_guest` correctly emails the creator (Karen) — that half happens to work, but it is coincidental and would still fail on any workspace with multiple collaborators.

The in-app conversation panel itself is fine — it decides "You vs Partner" from `sender_type`, so Karen sees her own messages as "You". The **bug is in recipient fan-out**, not in the UI.

## Fix

Make the messaging pipeline collaborator-aware. Route by workspace participants, not by the requester/creator pair.

### 1. `supabase/functions/send-collab-email/index.ts`

For `new_message` and `new_message_from_guest`:

- Load `workspace_collaborators` for the request (email + user_id → resolve email via `creators` / `auth.users` as we already do elsewhere).
- Build the participant set: `creator_email`, `requester_email`, all collaborator emails.
- Accept a new optional `senderEmail` in the request body (passed from the modals). If absent, fall back to today's behaviour so other call sites keep working.
- Compute `recipients = unique(participants) - senderEmail`. If the sender is the creator on a solo workspace, this correctly drops Karen and keeps Blessing.
- Send one email per recipient (loop `sendEmail([r], …)`) so each person gets a properly-addressed message and Resend logs stay clean. Keep the existing dedupe guard, but key it on `(request_id, type, to_email)` so fan-out isn't collapsed into a single "duplicate".
- Subject/body stay the same; only the recipient list changes.

### 2. `src/components/requests/SendMessageModal.tsx` and `GuestMessageModal.tsx`

Pass `senderEmail` in the `functions.invoke('send-collab-email', …)` payload so the function can exclude the sender from the fan-out. `SendMessageModal` already has `creatorEmail`; `GuestMessageModal` already has `senderEmail`.

No UI changes.

### 3. Conversation panel — leave as-is

`WorkspaceConversation` correctly renders sender labels from `sender_type`. Not touching it avoids regressions for classic 2-party collabs.

### 4. Regression coverage

Add a lightweight Deno test under `supabase/functions/send-collab-email/` that stubs the DB layer and asserts:

- Solo workspace + 1 collaborator + creator sends → recipient list = `[collaborator]`, not `[creator]`.
- Classic 2-party workspace + creator sends → recipient list = `[requester]` (unchanged behaviour).
- Collaborator sends on a solo workspace → recipient list = `[creator]`.

## Out of scope

- Redesigning the messaging UI for N-party workspaces (thread avatars, per-recipient reply, etc.) — separate follow-up.
- Backfilling missed emails from before this fix (I can send a one-shot nudge to Karen/Blessing if you want, but not part of this plan).
