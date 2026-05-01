## Fix the collaboration access breakage

### What I’m going to fix

1. **Repair the backend linking logic for existing users**
   - Add a secure insert-time reconciliation for `workspace_collaborators` so that when someone is invited by email **after they already have an account**, their `user_id` is filled immediately.
   - Replace the current no-op `link_request_to_existing_user()` behavior for `collab_requests` so requests created for an email that already belongs to an existing account can link to that account safely.
   - Run a one-time backfill for already-broken rows where the email matches an existing account but `user_id` / `requester_user_id` is still `NULL`.

2. **Fix login/signup return-to-workspace flow**
   - Preserve the intended workspace URL through:
     - `/login`
     - `/signup`
     - Google sign-in
   - Update post-auth redirect logic so **non-creators** (requesters and invited collaborators) are sent back to their workspace too, instead of only creators being auto-routed correctly.

3. **Keep access secure without loosening RLS**
   - Do **not** weaken workspace security.
   - Keep the current participant-based access model.
   - Only fix the identity-linking and redirect path so legitimate participants can reach their collaboration again.

4. **Verify against the actual broken cases**
   - Re-check the currently orphaned invite rows.
   - Re-check direct workspace access for a requester-owned collaboration.
   - Re-check direct workspace access for an invited collaborator.
   - Confirm the app redirects back to the exact workspace after auth.

---

## What I found

There are **two separate failures** causing the mess:

### A. Existing-account collaborators are not being linked
Your database currently has at least one collaborator invite where:
- the invite email matches a real account,
- but `workspace_collaborators.user_id` is still `NULL`.

That means the row exists, but RLS still denies access because policies check `user_id = auth.uid()`.

In plain English: the invitation exists, but the app never “attaches” it to the actual signed-in user.

### B. Direct workspace links are not surviving auth properly
The frontend preserves `state.from` for email/password login, but the Google auth flow does **not** preserve the original workspace destination. On top of that, the login page only auto-redirects when a `creator` profile exists.

That is wrong for guests and invited collaborators.

In plain English: even when someone is a valid participant, the auth flow can dump them in the wrong place.

---

## Technical details

### Files to update
- `supabase/migrations/...sql`
- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- likely `src/hooks/useAuth.tsx` or auth redirect handling if needed for OAuth restore

### Database changes
- Add or replace a trigger/function so `public.workspace_collaborators` sets `user_id` from `auth.users` by normalized email on insert.
- Replace the current no-op `public.link_request_to_existing_user()` with a safe normalized-email matcher for `collab_requests` inserts.
- Backfill existing broken rows where matching auth users already exist.
- Keep RLS unchanged unless a very small policy adjustment is strictly required for the repaired path.

### Frontend changes
- Preserve the target workspace path through login/signup and Google auth.
- Redirect authenticated non-creator users back to the original workspace instead of stalling on generic auth pages.

---

## Success criteria

- Invited collaborators can open their collaboration after logging in.
- Requesters can open their collaboration after logging in/signing up.
- Google sign-in returns users to the collaboration they started from.
- No RLS rollback, no public exposure, no “open access” shortcut.
- Known orphaned access rows are repaired.

If you approve this, I’ll implement it as one backend migration plus the auth redirect fixes, then verify the known broken collaboration paths.