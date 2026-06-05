## Problem

`EditableChapterTitle` writes the new title to `collab_requests.message` successfully, but it never tells React Query that the cached chapter list is stale. `ProjectDetail` reads chapters from the `["project_chapters", projectId]` cache via `useProjectChapters`, so the row keeps showing the old title until a hard refresh. The workspace header looks correct because it re-reads the row from its own query on mount.

## Fix

Invalidate the relevant queries from inside `EditableChapterTitle` right after a successful save — the component already owns the mutation, so this keeps the call site in `ProjectDetail` unchanged.

### `src/components/projects/EditableChapterTitle.tsx`
- Import `useQueryClient` from `@tanstack/react-query`.
- After the Supabase update succeeds (before `setEditing(false)` / `onSaved`):
  - `queryClient.invalidateQueries({ queryKey: ["project_chapters"] })` — matches every project's chapter list (we don't have `projectId` in this component, and partial-key invalidation is cheap).
  - `queryClient.invalidateQueries({ queryKey: ["workspace_request", chapterId] })` — keeps the workspace header in sync for any other open tab.
- Leave the optimistic local `value` as-is; React Query refetch will reconcile.

No changes needed in `ProjectDetail.tsx`, `Workspace.tsx`, or `useProjectChapters.ts`. No schema, RLS, or new dependencies.
