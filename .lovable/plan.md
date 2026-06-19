## Goal
Fix the mobile chapter row layout in `src/pages/ProjectDetail.tsx` so titles are readable, the stage selector doesn't squeeze them out, and the delete button isn't sitting at the screen edge where a scroll-tap can hit it. (Delete confirmation already exists via `AlertDialog` — keeping it.)

## Current mobile problems
- Single horizontal row tries to fit: drag handle, up/down arrows, title+writer, stage badge, 170px Select, delete icon.
- Title gets crushed to `Write` / `Elena Calvillo` wrapping; stage Select dominates width.
- Trash icon sits flush against the right edge — accidental taps while scrolling.

## Plan — responsive two-row layout on mobile, current row on `sm:` and up

Rework the `SortableChapterRow` children block (lines ~449-563) into a responsive layout:

### Row 1 (always visible)
- Left controls cluster: drag handle + up/down arrows (kept compact, `hidden sm:flex` for arrows on mobile — drag handle covers reordering; arrows shown on `sm+`).
- Title block (`flex-1 min-w-0`): `EditableChapterTitle` with `truncate`, writer line underneath. Gets full remaining width on mobile.
- Stage badge: hide on mobile (`hidden sm:inline-flex`) — redundant with the Select below.
- Delete button: move into an overflow `DropdownMenu` triggered by a `MoreVertical` icon on mobile (`sm:hidden`), and keep the inline trash icon on `sm+`. The dropdown opens away from the edge so a scroll-tap on the icon doesn't fire delete; the destructive action still routes through the existing `AlertDialog` confirmation.

### Row 2 (mobile only, `sm:hidden`)
- Full-width `Select` for chapter stage (`w-full` instead of fixed `w-[170px]`), placed below the title.
- "Assign writer" hint (when `!hasWriter`) moves here too so it doesn't wrap awkwardly.

### Desktop (`sm:` and up)
- Same single-row layout as today: drag, arrows, title, badge, 170px Select, assign-writer hint, inline trash button. No regression.

### Container tweaks
- Change the row wrapper inside `SortableChapterRow` from a single flex row to `flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3`.
- Add right padding (`pr-2`) so the overflow trigger/trash never sits flush to the card edge.

## Out of scope
- No DB, RLS, or hook changes.
- No changes to delete logic, drag-and-drop, or stage transition rules — confirmation dialog stays exactly as is.
- Desktop appearance unchanged.

## Files
- `src/pages/ProjectDetail.tsx` — restructure the chapter row JSX only. Add `DropdownMenu` + `MoreVertical` imports (shadcn primitives already in the project).
