# Discoverable Invites: Search First, Email Second

## Overview

Replace the email-only invite input with a two-mode flow: (1) search registered DraftKit creators by name/username, select their profile to invite them (email stays private); (2) fallback to email input for people not yet on DraftKit.

## Architecture

```text
User types "Karen" in search field
  → Client queries public_creator_profiles (name/username ilike)
  → Shows matching profiles (avatar + name + username)
  → User clicks a profile
  → Client calls edge function invite-by-profile({ requestId, creatorId })
    → Edge function (service role) looks up email from creator_contacts
    → Inserts into workspace_collaborators with user_id + email
    → Sends invite notification email
    → Returns success

Fallback: "Can't find them? Send Email Invite"
  → Reveals traditional email input (existing logic)
```

## Why an Edge Function for Profile Invites

The `workspace_collaborators` table requires `email` (NOT NULL), and `creator_contacts` is private (RLS: own contact only). So the client can't look up another creator's email. A service-role edge function bridges this safely.

## Files to Change


| File                                                  | Change                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/invite-by-profile/index.ts`       | **New**: accepts `{ requestId, creatorId }`, verifies caller owns the request, looks up email from `creator_contacts`, inserts workspace_collaborators row, deducts credit if not Pro, sends invite email via Resend                                                                                                  |
| `src/components/requests/InviteCollaboratorModal.tsx` | **Rewrite**: two-mode UI — default is search field querying `public_creator_profiles` with debounced ilike, showing avatar/name/username results. Below results: "Can't find them? Send Email Invite" button toggles to email input. Profile selection calls the edge function; email mode uses existing insert logic |
| `supabase/config.toml`                                | Add `[functions.invite-by-profile]` with `verify_jwt = false` (auth checked manually inside)                                                                                                                                                                                                                          |


## The Search UI

- Debounced input (300ms) querying `public_creator_profiles` by `name.ilike.%query%,username.ilike.%query%`
- Results: max 5, each showing profile image (or initials avatar), name, and @username
- Clicking a result triggers the invite immediately (with confirmation toast)
- Empty state: "No writers found matching '{query}'"
- Below results area: subtle link "Can't find the collaborator you're looking for?" → "Send Email Invite" button reveals email input

## Edge Function: `invite-by-profile`

1. Verify JWT, extract `auth.uid()`
2. Verify caller owns the request (`is_request_owner` check via query)
3. Look up target creator's email from `creator_contacts` where `creator_id = targetCreatorId`
4. Look up target creator's `user_id` from `creators` table
5. Insert into `workspace_collaborators` with `request_id`, `email`, `user_id`, `invited_by`
6. Handle duplicate key (already invited)
7. Deduct 1 credit if caller is not Pro
8. Fire invite email via `send-collab-email` pattern (fire-and-forget)
9. Return `{ success: true }`

## Privacy Guarantees

- Search only queries `public_creator_profiles` view (no email, no payment data)
- Email lookup happens exclusively server-side via service role
- Client never sees the invited person's email address
- Email fallback still requires the inviter to know the email (for off-platform people)

## Email Invite Fallback

When someone is invited by email and doesn't have an account yet, the existing `link_requests_to_new_user` trigger will auto-link them when they sign up. The invite email should make it clear they need to create an account to access the workspace.

**The Credit Friction** You mentioned deducting 1 credit for non-Pro users. If the "Invite" fails or they don't accept, does the user get their credit back?

- **PM Fix:** Only deduct the credit when the collaborator **accepts** the invitation, not when the invite is sent. This prevents "buyer's remorse" if an invite is ignored.