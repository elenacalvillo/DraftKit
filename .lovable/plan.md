# Permissions audit and rebuild: direct collabs and book projects

## What is actually broken (confirmed in the database and code)

1. **"Workspace not found" for you on all 3 SheWritesAI volumes.** You are a Cross-chapter Reviewer on Volumes 5, 6 and 7. The chapter page loads through a check that only knows three people: host, guest, and people invited into that single chapter. Project roles are ignored, so every chapter rejects you. Today the same thing happens to every Admin, Cross-chapter Reviewer and Peer Reviewer who wasn't also added to a specific chapter (13 of 45 project members have no chapter seat).
2. **The book page shows owner buttons to everyone.** Rename, Book details, Export, Archive, invite/remove members, and Send broadcast are visible to every member. Behind the scenes most of these are owner only, so a member clicks and gets an error (that's the "Not authorized for this project" crash on Preview recipients).
3. **Admin means different things in different places.** Admins can invite people and restore chapter history, but can't remove members, change roles or send broadcasts.
4. **Chapter Writers can read other writers' drafts.** The rule that lists chapters lets any project member read every chapter in the project, including the draft text, even though writers should only see chapters they're assigned to. The page hides it, but the data is reachable.
5. **Role descriptions contradict each other.** The invite menu says Peer and Cross-chapter Reviewers "can edit". The spec and the editor lock them to comments only.
6. **Book chapters list the host as both host and guest** (386 of 386 chapters). Anything that relies on "the guest" in a chapter, like notifications or display names, points back at the host.

Direct newsletter collabs (110 spaces) are mostly consistent: host, guest and invited collaborators all go through one access check. The gaps there are smaller: message and collaborator rules are written separately instead of reusing that check.

## Deliverables

### A. Current state report (saved to the full specs file)
- New version `DraftKit_Full_Specification_v4.md` with a new **Part 12. Permissions**:
  - Who exists: host, guest, invited collaborator (direct collabs); owner, admin, chapter writer, peer reviewer, cross-chapter reviewer (projects).
  - **Current state matrix:** each role vs. each action (open chapter, edit text, comment, message, see members, invite, remove, change role, broadcast, rename, book details, export, archive, delete chapter, restore history), showing what the screen shows and what the database actually allows, with mismatches flagged.
  - **Proposed matrix** (below) and the list of changes.
- `permissions-current-state.csv`: one row per person per collab or project, with their role, joined status, and what they can actually open today. Includes the 13 locked-out members and 6 unlinked invites.

### B. Proposed permission model (one rule set, used everywhere)

| Action | Owner | Admin | Cross-chapter Reviewer | Peer Reviewer | Chapter Writer |
|---|---|---|---|---|---|
| See the project and chapter list | Yes | Yes | Yes | Assigned only | Assigned only |
| Open a chapter | All | All | All | Assigned | Assigned |
| Edit chapter text | Yes | Yes | No, comments only | No, comments only | Assigned |
| Comment and message in a chapter | Yes | Yes | Yes | Assigned | Assigned |
| See member list | Yes | Yes | Yes | Yes | Yes |
| Invite, remove, change roles | Yes | Yes (not the owner) | No | No | No |
| Send broadcasts, preview recipients | Yes | Yes | No | No | No |
| Read broadcast history | Yes | Yes | Yes | Yes | Yes |
| Rename, Book details, create chapters, stages, reorder | Yes | Yes | No | No | No |
| Export book | Yes | Yes | Yes | No | No |
| Delete chapter, archive project | Yes | No | No | No | No |

Direct collabs keep today's model: host has control; guest and invited collaborators can write, message, mark published, and leave.

### C. Fixes
1. One shared "what can this person do in this project" check in the database, used by every rule, page and email function. The existing workspace access check stays the single source of truth for chapters and gains project roles, so Cross-chapter Reviewers and Admins open every chapter and writers open only theirs.
2. Replace the over-broad chapter-reading rule so writers can no longer read other writers' drafts.
3. Broadcasts, member management and invites accept Admins as well as the owner.
4. The book page asks once "what can I do here" and only shows the buttons you can use. Members without broadcast rights see history only, so the crash can't happen.
5. Fix the role descriptions in the invite menu to match the table.
6. Stop recording the host as the guest on new chapters; existing ones are handled so nothing that currently works breaks.
7. Tests for every cell in the proposed matrix, plus a real sign-in check as you on Volume 6.

## Decisions baked in (tell me if you want them different)
- Admin works like the owner except deleting chapters, archiving, or removing the owner.
- Cross-chapter Reviewers comment only and don't edit text, matching the current spec and editor.

## Technical section
- New SECURITY DEFINER `project_role(_uid, _project_id)` returning owner/admin/role/null, and `can_manage_project(_uid, _project_id)`.
- `has_workspace_access` extended: for `is_project_workspace` rows, also true when `project_role` is owner/admin/cross_chapter_reviewer, or when chapter_writer/peer_reviewer has a `workspace_collaborators` row on that chapter. `get_workspace_request`, messages, presence and revisions policies reuse it.
- Drop policy "Project members can view project workspaces" on `collab_requests`; replace with a policy based on `has_workspace_access`. `useProjectChapters` list query stays metadata only.
- `project_members` policies: owner OR admin manage (with a trigger blocking changes to the owner row and admin self-escalation to owner); members keep read access.
- `project-broadcast` and `send-project-invite` authorize through `can_manage_project`. Collaborator and message policies on direct collabs move onto `has_workspace_access`.
- Client: new `useProjectCapabilities` hook backed by one RPC; `ProjectDetail.tsx` gates header buttons, tabs and member controls on it; `PROJECT_MEMBER_ROLE_DESCRIPTIONS` corrected in `src/lib/access.ts`.
- Chapter creation stops setting `requester_user_id` to the host; readers of `requester_*` on project chapters are updated to use project members.
- Run the security linter after migrations; record the access rule in `AGENTS.md`.
