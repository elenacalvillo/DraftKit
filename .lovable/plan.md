# Invited project members shouldn't hit the paid Project paywall

Right now access to Book Projects is decided purely by subscription tier. Anyone who is invited into a project (even as Admin) sees the "Book Projects are a paid add-on tier" upgrade screen and cannot reach the project. Paying should only be required to *create and own* a project.

Confirmed current state:
- The database already allows this. `projects` has a `Members can view their projects` SELECT policy and `project_members` is readable by fellow members. Alex's membership row on project `5382a996…` exists with `role = admin`, `user_id` set and `joined_at` stamped.
- The block is frontend-only: `src/pages/Projects.tsx` and `src/pages/ProjectDetail.tsx` both return `ProjectUpgradePrompt` when `usePro().isProject` is false, and `DashboardLayout` only shows the "Projects" nav item for the paid tier.
- `useProjects()` also only lists projects the user *owns* (`creator_id = creator.id`), so even after unblocking the route an invited member would see an empty list.

## What changes

**Access rule**
- Own a project: requires the Project tier (unchanged).
- Be invited to a project: free. Full access to the chapters and features their role grants.

**Projects list page**
- Load two sets: projects owned by the current creator, plus projects where the user has a `project_members` row.
- Render them as "Your projects" and "Shared with you" (shared rows show the member's role, no archive/delete controls).
- The paywall screen only appears when the user has no Project tier *and* no memberships.
- The "New project" button stays gated on the paid tier. For a free invited member it is hidden and replaced with a small inline upsell line ("Want your own book project? Upgrade to Project tier") so the upsell is still present but not a wall.

**Project detail page**
- Replace the `!isProject` bail-out with: allow when the user is the owner (paid) or has a membership on this project. Otherwise show the upgrade prompt.
- Keep the existing role-based read-only / comment-only behaviour untouched.
- "Book details" and "Export book" buttons currently keyed off `isProject`; switch them to the same access flag so an invited Admin can use them, still respecting `isReadOnly`.

**Sidebar**
- Show the "Projects" nav entry when the user is on the Project tier or has at least one project membership.

## Technical notes

- New hook `useMyProjectMemberships()` in `src/hooks/useProjects.ts`: selects `project_id, role` from `project_members` for `auth.uid()`, plus a second query joining the matching `projects` rows (RLS already permits it). Cached 60s.
- New shared flag: `hasAnyProjectAccess = isProject || memberships.length > 0` for the list page and sidebar; `canAccessProject(projectId) = isProject-owner || membership for that project` for the detail page. Reuse the existing `useProjectMemberRole` hook for the per-project check instead of adding a parallel one.
- No migration needed — RLS and grants already support member reads. No change to `src/lib/access.ts` tier helpers; ownership/creation gating stays as-is.
