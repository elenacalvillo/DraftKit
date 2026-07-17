## Problem

In workspace `647ecb80-…`, Elena (a guest / invited collaborator) sees the sidebar say "Message Elena" and the partner card shows herself. The sidebar also shows "SOLO DRAFT" even though the room has 3 external collaborators. Same class of bug causes hosts to occasionally see themselves as their own partner and messages to loop back.

## Root cause (in `src/pages/Workspace.tsx`)

1. `visibleCollaborators` filters with `c.user_id === request?.creator_id`. But `creator_id` is `creators.id`, while `c.user_id` is an `auth.uid()`. The comparison is always false, so nobody is ever filtered out.
2. The current viewer is never filtered out of `visibleCollaborators`, so `visibleCollaborators[0]` can be the viewer themselves.
3. When `isSolo` is true, `partnerName = visibleCollaborators[0]?.display_name` unconditionally. A guest opening a solo-flagged project chapter that has collaborators picks themselves (or another random collaborator) instead of the host.
4. The sidebar "Solo Draft" card renders whenever `isSolo`, even if the room has real collaborators — so it labels active shared rooms as solo.

## Fix (frontend only, `src/pages/Workspace.tsx`)

1. Replace the `visibleCollaborators` filter: drop any row where `c.user_id === user.id` or `c.email === user.email` (case-insensitive). This removes the current viewer regardless of role.
2. Rewrite partner resolution:
   - Host viewing → partner is first `visibleCollaborators` entry, else `request.requester_name` (only when not solo).
   - Guest/collaborator viewing → partner is `creatorInfo.name` (the host), with the host's substack URL and profile image.
   - No suitable partner → `null` (button falls back to "Message Partner").
3. Apply the same rule to `partnerSubstackUrl`, `partnerProfileImage`, and `messageRecipientName`.
4. Sidebar card: only render the "Solo Draft / Invite collaborators when you're ready" block when `isSolo && collaborators.length === 0`. Otherwise render the partner card (works for both host and guest viewers thanks to the new resolution above).

No backend, RPC, or schema changes. No behavioral change to the message send pipeline itself — fixing partner resolution automatically fixes the "sending to myself" symptom because the modal reads `partnerName` / `messageRecipientName`.

## Verification

- Load workspace `647ecb80-…` as Elena → sidebar shows Karen / She Writes AI as partner, "Message Karen", no "Solo Draft" label.
- Load same workspace as Karen → sidebar shows Elena (or the next non-host collaborator) as partner.
- Load a genuinely solo project chapter with zero collaborators → sidebar still shows the "Solo Draft" label.
- Load a classic two-party collab → unchanged behavior.
