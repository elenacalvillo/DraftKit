## What's actually wrong

The email you got says **"With: Karen Smiley and Karen Smiley"** because of a real product bug, not just a typo.

What happened:
1. Yesterday you created a **solo workspace** from the Dashboard ("Start Writing Solo").
2. Solo workspaces are stored as a `collab_request` where `requester_name = creator.name` and `requester_user_id = creator.user_id` — i.e. Karen is recorded on **both sides** of the request (`Dashboard.tsx` line 274). That's by design so the workspace has a valid row.
3. Then you invited a collaborator (e.g. Elena) into that solo workspace.
4. The `workspace_invite` email template blindly renders `With: ${creatorName} and ${requesterName}` (`send-collab-email/index.ts` line 1050). Since both fields are "Karen Smiley", the recipient sees the duplicate.

I confirmed this against the row `ba45aef1…` in the DB: `is_solo = true`, both names = Karen Smiley.

So your instinct is right: the email is the visible symptom, but the actual issue is that **`is_solo` workspaces aren't handled when we present the participants** — the same pattern can leak into reminders, retrospective copy, and any place that uses requester/creator names to describe "the other party". The current code paths I checked (`Workspace.tsx`, `Requests.tsx`) already special-case `is_solo` for the title/partner label, but the invitation email does not.

## Plan

### 1. Fix `workspace_invite` email — `supabase/functions/send-collab-email/index.ts`
Replace the hard-coded `With: ${creatorName} and ${requesterName}` line with logic that reflects reality:

- If `request.is_solo` → render `With: ${creatorName}` (no "and …"), since the inviter is starting a solo room and pulling people in.
- Else if `creatorName === requesterName` (defensive dedupe for any other edge case) → render the single name only.
- Else → keep current `With: ${creatorName} and ${requesterName}`.

Also pull the actual `workspace_collaborators` list for that `request_id` and append the inviter so the line reads, when applicable: `With: Karen Smiley · plus 1 collaborator` (or list names if ≤3). This way recipients of a solo-room invite see who's actually in the room, not a fake "X and X" pair.

### 2. Audit and fix neighboring email templates
Same dedupe/solo guard for any other template that mentions both names. Quick grep showed only `workspace_invite` does the literal "and" join, but I'll also sanity-check:
- `collab_reminder` (host + guest reminders) — should not fire at all on solo rooms with no real second party. Add a `request.is_solo && requester_user_id === creator.user_id` short-circuit so we don't email Karen a reminder about meeting Karen.
- `published_together` / `collab_retrospective` — same short-circuit.

### 3. Tighten the data layer so this can't happen silently again
- `PublicBooking.tsx`: add a guard so a logged-in creator cannot submit a booking on their own public page (`user.id === creator.user_id` → block with a friendly toast). This was the other path that could create a self-on-self duo (non-solo) request.
- The solo-creation path in `Dashboard.tsx` is intentional and stays as is, but we'll mark these rows clearly in any name-rendering helper.

### 4. Centralize the "describe participants" logic
Add a small helper `src/lib/workspace-participants.ts` (and mirror it in the edge function) that, given a request row + collaborators list, returns a single string like:
- Solo, no collaborators: `"Karen Smiley (solo)"`
- Solo + 1 collaborator: `"Karen Smiley and Elena Calvillo"`
- Duo: `"Karen Smiley and Elena Calvillo"`
- Duo + extras: `"Karen Smiley, Elena Calvillo and 2 others"`

Replace the ad-hoc string in `workspace_invite` with this helper. Cover it with a Vitest unit test (incl. the duplicate-name regression).

### 5. Light backfill / cleanup
No DB migration needed — the row is fine. We just stop misrendering it.

## Files in scope

- `supabase/functions/send-collab-email/index.ts` — `workspace_invite`, `collab_reminder`, retrospective, published.
- `src/lib/workspace-participants.ts` — new helper.
- `src/lib/__tests__/workspace-participants.test.ts` — new tests (incl. "Karen and Karen" regression).
- `src/pages/PublicBooking.tsx` — block self-booking by the creator.
- (Edge function mirror of the helper — duplicated, since edge functions can't import from `src/`.)

## Out of scope
- No UI redesign of the email; only the participants line and short-circuits.
- No schema changes, no backfill of existing rows.
- The workspace UI partner labels are already solo-aware; not touching them.

## Why this is the right fix
The bug isn't "the email template has a typo". It's that the system has two valid shapes for a `collab_request` (solo vs duo) and one of the surfaces (the invite email) was written assuming only the duo shape exists. Patching only the visible string would leave reminders/retros to break the same way later. Fixing the helper + the self-booking guard + the solo short-circuits closes the whole class of bugs in one pass.
