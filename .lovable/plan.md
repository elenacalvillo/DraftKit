# Fix plan: Workspace partner messages failing for invited collaborators

## What’s broken
Invited collaborators in a shared workspace are being treated like the original requester for messaging UI, but their request payload is intentionally privacy-redacted. That leaves the message modal without a valid sender email, and the first insert into `collaboration_messages` fails because `sender_email` is required.

## What I’ll change

### 1) Fix role-aware message sending in the workspace
- Update `src/pages/Workspace.tsx` so invited collaborators do not use the requester-only message path blindly.
- Pass the authenticated user’s email into the collaborator message flow instead of relying on redacted request fields.
- Keep owner/requester/collaborator behavior explicit so future merges don’t collapse these roles again.

### 2) Make the guest/collaborator message modal safe
- Update `src/components/requests/GuestMessageModal.tsx` to accept the actual sender email as a prop.
- Add a defensive guard so the modal refuses to send and shows a useful error if the sender email is missing.
- Preserve analytics and existing success/error toast behavior.

### 3) Keep the conversation display aligned with three roles
- Verify `WorkspaceConversation` / workspace role logic still labels messages correctly for creator vs non-creator views.
- Ensure the first message from an invited collaborator appears immediately after send via the existing refresh flow.

### 4) Prevent publishing regressions
- Add or extend a focused test around workspace role/message behavior if there’s already a suitable test surface.
- Do a targeted codebase check for any other `GuestMessageModal` usage that could still pass the wrong sender identity.

## Technical details
- Root cause is frontend role wiring, not the message table schema.
- `collaboration_messages.sender_email` is `NOT NULL`.
- `get_workspace_request(...)` intentionally nulls requester PII for collaborator-only viewers.
- Because invited collaborators currently enter the `isGuestView` branch, the modal receives requester-derived data that may be null.
- The safest fix is to source sender identity from the authenticated session, not from the redacted request payload.

## Expected outcome
- In a workspace invited by Xian, you can start the conversation even when there were no previous messages.
- Message inserts succeed for creator, requester, and invited collaborator roles.
- No production crash on publish from this flow.