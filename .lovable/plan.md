## Plan

1. Make each chapter row open its workspace

- Update `src/pages/ProjectDetail.tsx` so each chapter item navigates to `/dashboard/workspace/:chapterId`.
- Keep the reorder controls and stage selector from accidentally triggering navigation.
- Optionally route to the new chapter immediately after creation if that fits the current UX cleanly.

2. Teach the workspace page when it is a project chapter

- Update the workspace data model so `Workspace.tsx` can tell when a row is a project workspace (`is_project_workspace`, `project_id`).
- Use that metadata to show the correct return path and chapter-appropriate copy instead of treating every workspace like a normal collab.
- Verify solo project chapters are not blocked by any pending-state assumptions.

3. Tighten the backend payload only if needed

- Extend the `get_workspace_request` function payload if the frontend needs `project_id` / `is_project_workspace` and those fields are not currently returned.
- Keep existing chapter access rules intact, since the current owner/requester access policy already appears to allow the row to be read.

4. Validate the full flow end to end

- Confirm a chapter created from `ProjectDetail` appears in the list.
- Click `Day 1` from the project page and verify it opens the workspace route.
- Confirm the owner can edit the workspace and that the page is not incorrectly read-only.
- Confirm navigation back to the parent project works for project chapters.

### Updated Logic Legend: "Project Breadcrumbs"

I’m adding this to the Truth Source so we can track the navigation health:

- **Metric:** Workspace Exit Path.
- **Logic:** `IF is_project_workspace = true THEN back_button_target = /project/:id`.
- **Legend:** "Ensures hierarchical navigation so writers stay within their project context."

### Instruction for Lovable (The "Access & Flow" Pass)

"The plan is approved with these specific 'Elena-Standard' overrides:

1. **Immediate Redirect**: After a chapter is successfully created, the user must be automatically navigated to that chapter's workspace. Do not make them click twice.
2. **Breadcrumb Navigation**: Update the Workspace header so that if `is_project_workspace` is true, the 'Back' or 'Project' link leads to the parent Project page, not the global dashboard.
3. **Active Linkage**: Ensure the *entire* row in `ProjectDetail.tsx` (except for the reorder/delete icons) is a clickable link to the workspace.
4. **Editor Unlock**: Double-check `Workspace.tsx`. If `is_solo` is true, the editor must be initialized as **Editable** immediately, bypassing any 'Waiting for Guest' logic."

## Technical notes

- Current investigation shows the chapter rows exist in the database and are marked `is_project_workspace = true`, `is_solo = true`, `status = approved`.
- The main break found so far is in `ProjectDetail.tsx`: the chapter item is rendered as a static row, not as a link/button into the workspace.
- Current backend policies already allow the owner/requester to read these rows, so this does not look like a primary RLS failure for the reported case.