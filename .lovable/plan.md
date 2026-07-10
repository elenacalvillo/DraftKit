## Diagnosis

The mini chapter list in the workspace and the project detail list disagree because they label chapters using **different sources**:

- `src/pages/ProjectDetail.tsx` (line 577) labels each row by its **position** in the sorted list: `${idx + 1}.`
- `src/components/projects/ChapterNavigator.tsx` (line 136) and `src/pages/Workspace.tsx` (line 600) label by the raw `**chapter_order**` column.

For most projects these match. But one of your books (project `6932ab4c…`, 76 chapters) has `chapter_order` running up to **85** — 9 gaps left behind by prior deletions/reorders. So:

- ProjectDetail shows Chapters 1..76 with no gaps.
- Workspace header shows e.g. "Ch. 9" while the same chapter is Chapter 8 in the project view.
- The mini navigator dropdown skips numbers (9, 11, 14…) making it look like chapters are missing when they are actually all there.

Count is fine (all 76 chapters render); only the labels are misaligned.

## Fix

Make position the single source of truth for the label everywhere. `chapter_order` stays the sort key and DB field, but the visible number always comes from the sorted position.

1. `ChapterNavigator.tsx`
  - Compute `position = i + 1` from the sorted list and use it in the dropdown row, prev tooltip, and next tooltip. Drop the `chapter_order ?? i + 1` pattern.
2. `Workspace.tsx` header (line 599–601)
  - Replace `Ch. ${chapter_order}.` with the position derived from `useProjectChapters(projectId)` — look up the current chapter's index and render `Ch. ${idx + 1}.`. Guard on `is_project_workspace` and hide the prefix while the chapter list is still loading (avoid a flash of the wrong number).
3. DONT RUN ANY DATABASE CLEANUP

No DB migration, no RLS changes, no data loss. Purely a display alignment.

## Files touched

- `src/components/projects/ChapterNavigator.tsx`
- `src/pages/Workspace.tsx`

Ready to implement on approval.