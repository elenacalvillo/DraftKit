## Problem

On book-project chapter workspaces the room is created as *solo* (`creator_id === requester_user_id`, both = Karen). The UI still treats `requester_*` as "the partner", so Karen sees herself in three places:

1. **Writer's Room sidebar** — Owner row + a duplicate row (from the collaborators list rendering Karen's own auth entry, or requester fallback) instead of Blessing.
2. **Conversation feed** — her own messages are labeled "Partner" because the label is derived from `sender_type` (`creator` vs `requester`) rather than the actual sender.
3. **Send Message modal + success toast** — title/toast pull `request.requester_name` (Karen's brand), not the invited collaborator's name.

The backend fanout was already fixed last turn — emails do reach Blessing — but the frontend copy lies.

## Fix

### 1. `src/components/requests/WorkspaceConversation.tsx`
Replace the `currentUserIsCreator` + `sender_type` heuristic with an identity check.

- Accept `currentUserEmail` (already indirectly available via `useAuth`).
- Compute `isMe = msg.sender_email?.toLowerCase() === user.email?.toLowerCase()`.
- Keep `currentUserIsCreator` as fallback only when `sender_email` is missing on legacy rows.
- Label: `isMe ? "You" : senderDisplayName ?? "Partner"`. Resolve `senderDisplayName` by matching `sender_email` against the creator email, requester email, or a passed-in collaborator map (small prop `participantsByEmail`).

### 2. `src/pages/Workspace.tsx` — Writer's Room sidebar
- Compute an `effectiveIsSolo` flag using `isEffectivelySolo` from `src/lib/workspace-participants.ts` (already exists) so project/chapter rooms collapse to a single Owner row.
- Owner row: append a `"You"` badge when `user.id === request.creator_id`.
- Filter the `collaborators.map` to drop any entry whose `user_id === request.creator_id` OR whose email matches the creator email — that removes the duplicate "Me/Joined" row that shows on solo rooms where the host also appears as a collaborator.
- For each remaining collaborator row, when `c.user_id === user.id` show a `"You"` badge; otherwise leave the existing display name (Blessing) untouched.
- Pass the enriched `collaborators` list down to `WorkspaceConversation` as `participantsByEmail` so bubbles above Blessing's messages read "Blessing" instead of "Partner".

### 3. Send Message modal + toast
Pick the *right* recipient name on solo/project rooms.

- In `Workspace.tsx`, derive `messageRecipientName`:
  - If `effectiveIsSolo` and at least one collaborator exists → first collaborator's `display_name`.
  - Else → `request.requester_name` (existing behavior for classic 2-party collabs).
- Pass this into `SendMessageModal` as a renamed prop `recipientName` (keep `requesterEmail` for legacy fanout, but the email arg is no longer used for routing since the edge function fans out server-side).
- Update `SendMessageModal.tsx`:
  - Rename `requesterName` → `recipientName` in the interface (single call site, safe rename).
  - Modal title: `Message {recipientName}`.
  - Success toast: `Message sent to {recipientName}!`.
- `GuestMessageModal.tsx` already uses `creatorName` correctly for the non-host side — no change needed there beyond confirming the title source.

### 4. Guest-side symmetry (Blessing's view)
When Blessing opens the chapter as a collaborator, `isGuestView` is true and `GuestMessageModal` shows `creatorName={creatorInfo?.name}` — that's Karen's brand, which is correct for her. No change.

## Out of scope
- Backend recipient fanout (already fixed).
- Renaming `sender_type` values in the DB — we treat them as legacy and rely on `sender_email` for identity.

## Files touched
- `src/pages/Workspace.tsx` (sidebar filtering, recipient name derivation, prop wiring)
- `src/components/requests/WorkspaceConversation.tsx` (identity-based labels, participants map)
- `src/components/requests/SendMessageModal.tsx` (prop rename, title/toast copy)

## Verification
- Solo project chapter as host with 1 invited collab: sidebar shows Owner (You) + Blessing; modal title "Message Blessing"; toast "Message sent to Blessing"; own bubbles read "You", Blessing's read "Blessing".
- Classic 2-party collab (non-solo): no visible change — still "Message {requester_name}", "You" / "{requester_name}" bubbles.
- Blessing's guest view: modal still says "Message {Karen's brand}", her own bubbles read "You".
