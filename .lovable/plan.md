## Problem

Karen can't rename a book project. There's no UI to edit `projects.title` or `projects.description` after creation.

## Fix

Add an inline "Edit project" affordance available to the project owner in two places, backed by an existing update path.

### Backend

- `projects` table already has `title` and `description`, RLS restricts writes to the owning creator. No schema change needed.
- Add `useUpdateProject` mutation in `src/hooks/useProjects.ts` that updates `title` (required, trimmed, non-empty) and `description` (nullable) by `id`, then invalidates `["projects"]` and `["project", id]`.

### Frontend

1. `src/pages/ProjectDetail.tsx` (primary entry point Karen uses):
   - Add a small pencil icon next to the project title in the header.
   - Clicking opens an "Edit project" dialog (reuses the same form shape as the create dialog: Title + Description).
   - On submit → call `useUpdateProject`, toast success, close dialog. Title updates in-place via query invalidation.
   - Only visible to the project owner (already the only role that can reach this page for their own project).

2. `src/pages/Projects.tsx`:
   - Add the same pencil icon on each active project row (next to Archive) so users can rename without opening the project.
   - Reuses the same edit dialog component.

3. Extract the edit form into `src/components/projects/EditProjectDialog.tsx` so both pages share it (mirrors the pattern of `MoveChapterDialog`, `ExportBookDialog`).

### Validation

- Title required, trimmed, max length matches current create form.
- Show inline error if empty; disable Save while pending.
- Error toast with message on failure (e.g. RLS rejection).

### Out of scope

- No archive/unarchive changes.
- No cover image, slug, or visibility fields — Karen only asked for rename. Description is included because it's already in the create form and trivial to reuse.
