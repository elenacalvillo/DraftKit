# Fix project member invites: no email, and false "Joined" status

Both problems are confirmed in the code and in your project's data.

## What is actually broken

**1. No invite email exists for project members.**
Adding someone on the Members tab only writes a database row. There is no email
type for project invites at all (the email function handles chapter/collab
invites and messages, nothing project level). So elenacalvilloalcalde@gmail.com
was added silently and never notified.

**2. "Joined" is stamped automatically.**
The insert trigger on project members sets `joined_at = now()` whenever the
invited email matches an existing DraftKit account. That is why your test
address shows "Joined" without accepting anything, while javalosorozco@gmail.com
(no account) correctly shows "Pending invite".

Confirmed rows on Verloren:
- elenacalvilloalcalde@gmail.com - has account, `joined_at` stamped at insert
- javalosorozco@gmail.com - no account, `joined_at` null

## The fix

### Send a real project invitation email
New `project_invite` email type, using the existing DraftKit branded header and
the "via DraftKit" relay From pattern:

- Subject: `<Host> invited you to <Project title>`
- Body: who invited them, project title, their role and what the role can do,
  and a single CTA button that deep links to the project accept URL
- Logged in `email_events` like every other send

Fired for all three add paths: search writers, pick from project people, and
invite by email. Also fired when the auto-sync trigger adds a chapter author to
the project for the first time? No - chapter authors already got a chapter
invite, so no duplicate email there.

Resend button on each pending member row, so you can re-notify anyone from the
backfill who never got a project email.

### Make "Joined" mean joined
- Stop auto-stamping `joined_at` on insert. Having a DraftKit account is not
  acceptance.
- `joined_at` is set only when the invited person opens the project accept link
  while signed in with that address (new accept RPC), or when they open the
  project from their own dashboard.
- Keep linking `user_id` at insert time - that is what makes the invite resolve
  to the right account, and it does not imply acceptance.
- One-time data correction: clear `joined_at` for project members who never
  actually did anything in the project, while keeping "Joined" for anyone whose
  chapter workspace record shows a real join.

### Accept flow
`/dashboard/projects/:id/accept?token=...` style route that:
- signed in with the invited email: marks joined, redirects into the project
- signed in with a different address: explains the mismatch and offers to accept
  as the signed in account
- not signed in: routes through login and returns to the accept link

Pending members keep read access blocked until accepted, same as today.

## Technical notes

- Migration: drop the `joined_at := now()` branch from
  `link_project_member_on_insert`; add `accept_project_invite(_project_id)`
  security definer RPC that stamps `joined_at` for `auth.uid()`'s member row;
  add corrective `UPDATE` for falsely joined rows (those with no matching
  `workspace_collaborators.joined_at` and no project activity).
- `supabase/functions/send-collab-email/index.ts`: add `project_invite` branch,
  resolving host name from `creators` and project title from `projects`, then
  redeploy.
- `src/hooks/useProjectMembers.ts`: after `inviteMember` and
  `addMemberByCreator` succeed, invoke the email function; add a
  `resendInvite` mutation.
- `src/components/projects/AddProjectMember.tsx` and
  `src/pages/ProjectDetail.tsx`: success toast says "Invitation sent to X";
  pending rows get a Resend action.
- New route + page for the accept link, wired in `src/App.tsx`.
