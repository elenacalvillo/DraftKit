# Why reordering feels slow today

Two real causes, both in `src/hooks/useProjectChapters.ts` + `src/pages/ProjectDetail.tsx`:

1. **No optimistic UI.** Clicking ▲/▼ calls `reorderChapters.mutateAsync(...)`, waits for the network round-trip, then waits for React Query to invalidate and refetch the whole chapter list before the row visibly moves. That's typically 2 sequential round-trips before any pixel changes.
2. **N sequential UPDATEs.** `reorderChapters` loops over every chapter and issues a separate `supabase.update(...).eq("id", ...)` for each one — even when only two rows actually swapped. For a 20-chapter book that's 20 serial HTTP calls per arrow click.

# Plan

## 1. Make the arrows feel instant (optimistic update + minimal writes)

In `src/hooks/useProjectChapters.ts`:

- Add a new mutation `swapChapters({ aId, bId, aOrder, bOrder })` that issues only the two `UPDATE`s needed for an adjacent swap, in parallel via `Promise.all`.
- Add `onMutate` / `onError` / `onSettled` to do an **optimistic cache update** on `["project_chapters", projectId]`: reorder the array in place, snapshot the previous value, roll back on error, and skip the post-success invalidate (or do a silent background refetch) so the UI never flashes.
- Keep `reorderChapters` (used for drag-and-drop, see below) but also give it optimistic cache updates and switch its body to `Promise.all` of the updates instead of a `for await` loop. Only write rows whose `chapter_order` actually changed.

In `src/pages/ProjectDetail.tsx` `handleMove`:

- Call the new `swapChapters` mutation with the two neighbors instead of `reorderChapters` over the full list.
- Disable the arrow buttons only on the row being moved (visually) but don't block on the network — the optimistic update already moved the row, so the user can click again immediately.

Expected result: arrow clicks update the list in the next frame; the DB write happens in the background.

## 2. Add drag-and-drop reordering

Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (lightweight, already the de-facto choice in the Tailwind/Radix ecosystem).

In the chapter list section of `ProjectDetail.tsx`:

- Wrap the chapter list in `<DndContext>` + `<SortableContext strategy={verticalListSortingStrategy}>`.
- Extract each chapter row into a small `SortableChapterRow` component that uses `useSortable({ id })` and applies `transform` / `transition` via `@dnd-kit/utilities`.
- Add a drag handle (grip icon, `lucide-react` `GripVertical`) on the left of each row, visible on hover/focus, with `{...attributes} {...listeners}` so the title and pencil-edit affordance still work normally.
- On `onDragEnd`, compute the new ordered id array with `arrayMove`, call `reorderChapters.mutateAsync(newIds)` (which is now optimistic + parallel). Keep the ▲/▼ arrows as a fallback for keyboard / touch users — `useSortable` already supplies keyboard support, but the arrows remain familiar.

Accessibility: `@dnd-kit` ships keyboard sensors and screen-reader announcements out of the box; wire up `KeyboardSensor` with `sortableKeyboardCoordinates`.

## 3. Files touched

- `src/hooks/useProjectChapters.ts` — add `swapChapters`, rewrite `reorderChapters` to parallel + only-changed rows, add optimistic cache updates to both.
- `src/pages/ProjectDetail.tsx` — switch arrow handler to `swapChapters`, wrap chapter list in `DndContext` + `SortableContext`, extract `SortableChapterRow`, add `GripVertical` handle.
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

No schema changes, no RLS changes, no edge function changes. Existing `chapter_order` column and `Creators can update own requests` policy already cover the writes.
