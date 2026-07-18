# Explain Project Roles in the UI

Karen (and other project owners) can assign 4 roles when inviting collaborators to a book project, but the UI never explains what each one actually does. Today it's just a dropdown of labels ("Admin", "Chapter Writer", "Peer Reviewer", "Cross-chapter Reviewer") with zero context — so people guess, or ask.

## The definitions (source of truth: `project_member_role` + `project_member_can_access_chapter` in `20260502120100_book_projects_rls.sql`)

| Role | What they can do | Best for |
|---|---|---|
| **Admin** | Full control of the project: rename it, add/remove members, change roles, create and delete chapters, edit any chapter, publish. Same powers as the owner except transferring ownership. | A co-author or trusted managing editor you want to run the project alongside you. |
| **Chapter Writer** | Can open and edit **only the chapters they've been assigned to**. Can't see or edit other chapters, can't invite people, can't change project settings. | Contributors writing one specific chapter (guest authors, ghostwriters). |
| **Peer Reviewer** | Can open and comment/edit **only the specific chapters they've been assigned to review**. Same scope limits as Chapter Writer — everything else in the project stays hidden. | A beta reader or fellow writer giving feedback on one chapter at a time. |
| **Cross-chapter Reviewer** | Can open and edit **every chapter in the project**, but can't manage members or project settings. | A developmental editor or continuity reader who needs to see the whole manuscript to catch inconsistencies. |

Owner is not a member role — it's whoever created the project and can't be reassigned from this UI.

## What to build

1. **Single source of truth for role copy** — add a `PROJECT_MEMBER_ROLE_DESCRIPTIONS` map in `src/lib/access.ts` next to the existing `roleLabel()` helper. One short sentence per role, matching the table above. Reuse everywhere so we never fork the wording.

2. **Explain roles inside the Invite / Manage Members panel** (`src/pages/ProjectDetail.tsx`, around the members section at line ~731):
   - In the role `<Select>` used for both **inviting a new member** and **changing an existing member's role**, render each `SelectItem` with the label on top and a small muted description underneath (same pattern shadcn uses for rich select items). So the dropdown itself teaches what each option means.
   - Next to the "Members" section heading, add a `MetricInfo`-style ⓘ button (reuse the existing `Tooltip` primitive — no need to extend `MetricInfo` which is analytics-specific) that opens a popover listing all four roles with their one-line descriptions. This gives a full reference without needing to open the dropdown.

3. **Show the description on the member row** — under each member's name in the members list, show `roleLabel(role)` (already there) plus a very short suffix like "· can edit assigned chapters only" so the owner sees at a glance what access each person actually has, without opening the dropdown.

No backend or schema changes — RLS already enforces all of this correctly. This is a pure frontend clarity pass.

## Files touched

- `src/lib/access.ts` — add `PROJECT_MEMBER_ROLE_DESCRIPTIONS` + a helper `roleDescription(role)`.
- `src/pages/ProjectDetail.tsx` — enrich the role `<Select>` items, add the ⓘ roles-reference popover on the Members section, add the description suffix on each member row.
- `src/lib/__tests__/access.test.ts` — add a small test that every `PROJECT_MEMBER_ROLES` entry has a matching label and description (prevents future drift).

## Out of scope

- Renaming roles or changing permissions.
- Adding a new role (e.g. read-only "Viewer") — happy to plan that separately if you want it.
- Surfacing role descriptions on the guest's side (they don't pick their own role); can add later if useful.
