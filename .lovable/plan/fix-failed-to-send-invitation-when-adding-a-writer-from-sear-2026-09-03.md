# Fix "Failed to send invitation" when adding a writer from search

Not caused by the recent changes. Confirmed by querying the database.

## What is actually happening

Farida's creator record has **no contact email row**. The invite function looks
up the invitee's email in `creator_contacts`, finds nothing, and returns 404
"This creator hasn't set up their contact email yet". The modal then shows the
generic "Failed to send invitation. Please try again." because a non-2xx
response from a function call throws before the code that reads the real error
message, so the useful text is thrown away.

Scope of the data gap: 18 of 101 creators have no `creator_contacts` row, and
every one of them was created on 2026-05-20 (a legacy batch, before the profile
creation RPC wrote both tables atomically). Nothing from the last weeks.

## The fix

1. **Stop depending on a possibly missing row.** In `invite-by-profile`, when
   `creator_contacts` has no email and the creator has a linked account, read
   that account's email from auth and use it, then write it back into
   `creator_contacts` so every later email (invites, reminders, digests) works.
   Only genuinely account-less creators still return a 404.

2. **Backfill the 18 legacy creators** with the email on their linked account,
   so reminders, retrospectives and release notes reach them too.

3. **Show the real reason in the UI.** The invite modal reads the error body
   returned by the function and surfaces that message ("already invited",
   "profile is not public", etc.) instead of the generic retry toast. Same for
   the email-invite path.

## Technical notes

- `supabase/functions/invite-by-profile/index.ts`: after the `creator_contacts`
  lookup, fall back to `adminClient.auth.admin.getUserById(creator.user_id)`
  and upsert `creator_contacts (creator_id, email)`. Keep the existing public
  profile gate and ownership check untouched.
- Migration: `INSERT INTO public.creator_contacts (creator_id, email) SELECT
  c.id, lower(u.email) FROM creators c JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN creator_contacts cc ON cc.creator_id = c.id WHERE cc.creator_id IS
  NULL AND u.email IS NOT NULL ON CONFLICT DO NOTHING`. Read-only against
  `auth`, no schema change there. Respects the existing unique email index.
- `src/components/requests/InviteCollaboratorModal.tsx`: parse
  `FunctionsHttpError` context JSON in `handleProfileInvite`, map known cases,
  fall back to the raw message; no credit or state logic changes.
- No RLS, storage, or sanitization changes.
