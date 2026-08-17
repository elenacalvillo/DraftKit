# Close the gap between chapter collaborators and project members

Karen's problem: broadcasts go only to people listed on the project **Members** tab, but her 36 chapter authors live inside chapter workspaces. So she is re-typing emails she can't even see, and guessing which address she used.

Four changes, in order of impact.

## 1. Broadcasts reach chapter collaborators automatically

The broadcast function currently reads only `project_members`. Change the recipient list to the union of:

- project members (as today)
- every collaborator invited to any chapter workspace of that project
- the guest/requester on each chapter, when there is one

Dedupe by normalized email. The broadcast card shows the resolved recipient count before sending, and each recipient still gets one logged `email_events` row.

Result: Karen does not need to add anyone to Members for messaging to work.

## 2. Auto-add chapter collaborators as project members

When someone is invited to (or joins) a chapter workspace that belongs to a project, register them on the project as **Chapter Writer** if they are not already a member. Handled by a database trigger on `workspace_collaborators` so it works for every invite path, plus a one-time backfill for Karen's existing 36 chapters.

If a person is already a member with any role, the existing role is left alone.

## 3. "Add member" becomes a people picker

Replace the raw email box on the Members tab with the same search pattern used for chapter invites:

- Search DraftKit writers by name or handle (registered accounts, so the email is guaranteed correct)
- A "People already in this project" list of everyone invited across the project's chapters, one click to add
- "Invite by email" stays available as a fallback

## 4. Status and invited email visible in the Collaborations list

On each project chapter row, show:

- a **Pending invite** / **Joined** badge per collaborator state
- the email address the person was invited under, so Karen never has to guess Google vs Substack again

Chapter rows in the project view get the same collaborator summary (name, state, invited email).

## Technical notes

- `supabase/functions/project-broadcast/index.ts`: build recipients from `project_members` plus `workspace_collaborators` and `collab_requests.requester_email` joined through `collab_requests.project_id`, deduped via `normalize_email`.
- New migration: trigger on `workspace_collaborators` insert/update that upserts into `project_members` (role `chapter_writer`) when the parent request has a `project_id`; `ON CONFLICT DO NOTHING`. Plus a backfill statement for existing rows.
- New hook to list project-wide collaborators (security definer RPC so the owner can read collaborator emails across chapters without widening RLS).
- `src/pages/ProjectDetail.tsx` Members tab: swap the email input for a picker component reusing the `public_creator_profiles` search from `InviteCollaboratorModal`.
- `src/pages/Collaborations.tsx` + chapter rows: render collaborator state badges from the new RPC data.
- No change to storage accounting, sanitization, or workspace access rules.
