# Fix terrifying empty-state flash + speed up Project page with 50 chapters

## Problem
On `/dashboard/projects/:id`, while `useProjectChapters` is still fetching, `chapters.length === 0` is true, so the "No chapters yet…" empty-state card renders for a beat — looking, to a writer with 50 chapters, like the entire book vanished. The query also does `select("*")`, pulling every chapter's full `shared_content` HTML, `ai_draft` JSON, `editing_sessions` JSON, etc. on first paint. That's the freeze.

## Fix

### 1. `src/hooks/useProjectChapters.ts` — slim down the list query
- Replace `.select("*")` in `chaptersQuery` with an explicit metadata column list:
  `id, project_id, creator_id, message, chapter_order, chapter_stage, status, requester_user_id, requester_email, requester_name, requester_profile_image_url, is_project_workspace, is_solo, created_at, updated_at`.
- Add a new exported type `ChapterListItem` for that shape; keep the existing `Chapter = Tables<"collab_requests">` export for the mutations that still need the full row.
- Update `chaptersQuery`'s return type to `ChapterListItem[]` and cast accordingly.
- `createChapter`, `updateChapterStage`, `assignWriter` mutations still `.select("*")` for the single returned row — fine, the cache is overwritten by invalidation anyway. After their `onSuccess` invalidate, the list refetches with the slim payload.
- Reorder/swap/delete optimistic updates already operate on the cached list shape — they keep working because they spread existing rows.
- Already returns `isLoading: chaptersQuery.isLoading`. No API change needed beyond the type tweak — `ProjectDetail.tsx` only reads `id`, `chapter_order`, `chapter_stage`, `message`, `requester_user_id` from the list (verified via grep), so nothing breaks.

### 2. `src/pages/ProjectDetail.tsx` — proper loading state, no false empty
- Pull `isLoading` (alias `isChaptersLoading`) out of `useProjectChapters`.
- Replace the `chapters.length === 0 ? <empty card> : <DndContext>…` block at line 405 with three branches:
  1. `isChaptersLoading` → render a `ChapterRowSkeleton` list (6 rows) using the existing `@/components/ui/skeleton` primitive. Each skeleton matches the actual row height/padding (`h-14 rounded-lg`) so the layout doesn't jump.
  2. `!isChaptersLoading && chapters.length === 0` → existing empty-state card unchanged.
  3. Otherwise → existing DnD list unchanged.
- Keep the skeleton component inline at the bottom of the file (small, single-use). No new files.

## Out of scope
- Pagination / virtualization for 100+ chapters (current 50-chapter case fits comfortably once `shared_content` is removed from the list payload — typical reduction is ~99% of bytes).
- Workspace-page lazy loading — already fetches per-chapter on entry via `Workspace.tsx`.

## Files
- `src/hooks/useProjectChapters.ts` — slim `select()`, add `ChapterListItem` type.
- `src/pages/ProjectDetail.tsx` — branch on `isChaptersLoading`, render skeleton rows.

No DB, RLS, or edge-function changes.
