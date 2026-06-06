# Chapter deletion UX

## Problem

Chapters are stored as `collab_requests` rows with `is_project_workspace = true`, reusing the collab workspace UI. As a result:

- **No way to delete a chapter** from the Project page — the rows have move/reorder/status controls but no trash action.
- Inside the chapter workspace, the only destructive control is **"Cancel Collab"**, which sets `status = 'cancelled'` and locks editing. For a project chapter this is confusing: it leaves an orphaned "cancelled chapter" in the project list that the user actually wants gone.

## Plan

### 1. `src/hooks/useProjectChapters.ts` — add `deleteChapter` mutation
- New mutation `deleteChapter({ chapterId })` that does `supabase.from("collab_requests").delete().eq("id", chapterId)`.
- RLS `Creators can delete own requests` already covers this — no schema/policy changes.
- Optimistic cache update on `["project_chapters", projectId]`: remove the row immediately, snapshot for rollback on error.
- Export from the hook alongside the existing mutations.

### 2. `src/pages/ProjectDetail.tsx` — per-row delete button
- Add a `Trash2` ghost icon button at the end of each `SortableChapterRow`, visible only when `!isReadOnly` (owner), styled `text-muted-foreground hover:text-destructive`.
- Wrap in an `AlertDialog` with copy:
  - Title: "Delete this chapter?"
  - Description: "This permanently removes \"{chapter title}\" and all of its drafted content. This cannot be undone."
  - Confirm button: "Delete chapter" (destructive variant)
- On confirm, call `deleteChapter.mutateAsync({ chapterId: c.id })`, toast success/error.
- Renumbering happens naturally because the list re-renders with one fewer item; `chapter_order` gaps are harmless (the query orders by it, then `created_at`).

### 3. `src/pages/Workspace.tsx` — context-aware destructive action
When `request.is_project_workspace === true` and viewer is owner:
- Replace the "Cancel Collab" `AlertDialog` block (lines 974–1023) with a **"Delete Chapter"** variant:
  - Title: "Delete this chapter?"
  - Description: "This permanently removes this chapter and its drafted content from your project. This cannot be undone."
  - Confirm: `supabase.from("collab_requests").delete().eq("id", request.id)`, then `navigate("/dashboard/projects/" + request.project_id)`.
  - Skip the `send-collab-email` `collab_cancelled` invocation (no external collaborator to notify on a solo chapter).
- Keep the existing "Cancel Collab" behavior unchanged for normal (non-chapter) collabs.

Implementation note: gate via `request.is_project_workspace` (already on the row, in `types.ts`). Use a small `isChapterWorkspace` boolean inside the existing owner-only block to swap labels/handlers without duplicating the surrounding JSX.

## Files touched

- `src/hooks/useProjectChapters.ts` — new `deleteChapter` mutation with optimistic update.
- `src/pages/ProjectDetail.tsx` — per-row trash button + confirm dialog.
- `src/pages/Workspace.tsx` — split owner destructive action into "Delete Chapter" vs "Cancel Collab" based on `is_project_workspace`.

No DB schema, RLS, or edge function changes.
