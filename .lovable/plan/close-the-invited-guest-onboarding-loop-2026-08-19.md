# Close the invited-guest onboarding loop

Neha got DraftKit notifications, tried to reset a password, and got nothing back — because she was only an invited email address, never an account. The app never told her that. Three fixes, all on the paths she actually touched.

## 1. Password reset that never dead-ends

Today the reset page always says "check your email", even when no account exists. That is safe but useless.

New behaviour: a single backend endpoint handles the request and always sends something.

- Account exists -> normal password reset email (unchanged).
- No account, but the email has pending invites or pitches waiting -> "Claim your invitations" email with a signup link pre-filled with that email.
- Neither -> nothing sent.

The page keeps one neutral confirmation message in all cases plus a visible line: "No account yet? You can also create one with this email" linking to signup with the email prefilled. That way she is never stuck, and we still don't leak who has an account.

## 2. Invite and notification emails point at signup with the email prefilled

Every guest-facing email link that can land on a login wall gets the invited address attached, so the signup form opens already filled in and the person keeps their intended destination:

- Workspace invites
- New message notifications to guests
- Project invites (already has a signup link, gets the email added)

Copy on those emails gets an explicit line: "New to DraftKit? Create your free account with this email address to open the collab."

## 3. Signup recognises a pending invite

When signup is opened with a prefilled email, show a short banner above the form: "You were invited to collaborate. Create your account with this email to claim it." Also make the email field read as intentional rather than accidental, and keep the existing `next=` redirect so they land on the right workspace or project after signing up.

Login gets the matching escape hatch: under the sign-in error, a line pointing to signup with the typed email carried over.

## 4. Neha specifically

Nothing to repair in the database — she has no rows to fix. After these changes she can sign up with any of her three addresses and any invite tied to that exact address will link automatically through the existing guest-linking triggers. Worth telling her to use `Neha.Kabra@hotmail.com` since that is the address Karen invited.

## Technical notes

- New edge function `account-recovery-assist`: validates the email with Zod, uses the service role to check `auth.users`, then either calls the reset flow or checks `workspace_collaborators` / `project_members` / `collab_requests.requester_email` for pending rows and sends a claim-invite email through Resend. Responds with a constant shape so the client cannot enumerate accounts. Rate-limited per email.
- `src/pages/ForgotPassword.tsx` calls that function instead of `supabase.auth.resetPasswordForEmail` directly, and gains the signup escape link.
- `supabase/functions/send-collab-email/index.ts`: extend `signupWithNext` to accept an email and append `&email=`; apply it to the `workspace_invite` and guest message templates.
- `supabase/functions/send-project-invite/index.ts`: append `&email=` to `signupUrl`.
- `src/pages/Signup.tsx`: invite banner when `?email=` is present. `src/pages/Login.tsx`: signup fallback link carrying the typed email.
- No schema changes.
