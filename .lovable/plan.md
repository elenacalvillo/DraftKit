# Fix wrong collaborator name and self-addressed update emails

Both problems you hit came from the same draft. I checked the actual data, and the good news is nothing was invited wrong.

## What actually happened

You invited **Juan Gonzalez (@juanfrank77)**. The database row for that invite is correct: it points at Juan's account, and his account email is `seminariopv@hotmail.com`.

The app then displayed him as "Seminariopv" because it failed to read his real name and silently fell back to guessing a name from the email address. It guesses by taking the part before the `@` and capitalizing it. So "Juan Gonzalez" became "Seminariopv" everywhere in that workspace: the Writer's Room list, the partner card, the Message button.

Why the read failed: the app looks up collaborator names in the private `creators` table, which by security policy only ever returns your own row. Every other person's name comes back empty. The public profile view (`public_creator_profiles`) is the surface that is allowed to return other people's names, and it is what the invite search already uses successfully. That is why Juan's real name and photo appear correctly in the search dialog and then disappear once he is added.

The email problem is separate and real. The draft you created is a solo draft, which means the "guest" side of the record is you. The workspace-updated email is hard-coded to send to that guest field, so it went to you and Juan received nothing at all.

## Fix 1: show the real person, never guess from the email

- Enrich collaborators from the public profile view instead of the private `creators` table, so real names, usernames, and avatars load for everyone.
- Keep the email-derived name only for genuine email-only invites (people with no DraftKit account yet), and prefer `@username` over a guessed name when a profile exists but has no display name.
- This corrects the Writer's Room list, the partner card, the Message button label, and the cancel/remove confirmation text at once, since all of them read the same value.

## Fix 2: send workspace update emails to the actual collaborators

- Route the "workspace updated" email through the same participant fan-out already used by workspace messages: collect the host, the guest, and every invited collaborator, then drop the person who triggered the save.
- Pass the sender's email from the editor when the save fires the notification, which is what makes the exclusion possible.
- If the only remaining recipient is the sender (a truly solo draft with nobody invited), send nothing instead of emailing them their own update.
- Make the greeting in that email neutral rather than addressing the guest field by name, since it now goes to several people.

## What you will see afterwards

- Juan appears as **Juan Gonzalez** with his avatar in the Writer's Room, and "Message Juan".
- Saving with notify on emails Juan, not you.
- Existing invite rows need no repair. The one in this draft is already correct and will simply render properly.

## Technical notes

- `src/hooks/useWorkspaceCollaborators.ts`: switch the profile enrichment query from `creators` to `public_creator_profiles`, keyed by the profile `id` plus a `user_id` match, and tighten `deriveDisplayName` so it only guesses from email when no profile was found.
- `supabase/functions/send-collab-email/index.ts`: include `workspace_updated_by_creator` and `workspace_updated_by_guest` in the fan-out branch at the messaging section, and change the updated-workspace greeting away from `requesterNameHtml`.
- `src/components/requests/SharedWorkspace.tsx`: include `senderEmail` in the `send-collab-email` body for the update notification.
- No schema changes, no migrations, no data repair.
