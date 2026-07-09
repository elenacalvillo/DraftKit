# Chapter Navigator in the Workspace Header

Give project chapters a book-like navigation control inside the zen workspace so you can flow from chapter to chapter without bouncing back to the Project view.

## What you'll see

Right next to the existing `Drafting: <Chapter Title>` in the top header, a compact navigator appears — only when the current workspace is a **project chapter** (i.e. `is_project_workspace = true` and `project_id` is set). Solo drafts and collab workspaces are unchanged.

Layout in the header, left to right:

```text
[‹]  Drafting:  Ch. 3 — Lo que el fuego despierta ▾  [ ✎ ]  [›]
```

- **‹ / › chevrons** — jump to the previous / next chapter in `chapter_order`. Disabled (greyed) at the ends of the book. Tooltip shows the target title ("Next: Ch. 4 — La Laguna").
- **Title dropdown** — clicking the title (or the small ▾ next to it) opens a popover listing every sibling chapter, ordered by `chapter_order`, with:
  - Chapter number + title (truncated)
  - Small stage badge (Draft / Editing / Ready…)
  - The current chapter highlighted, scrolled into view on open
  - Selecting a chapter navigates to its workspace
- **Pencil (rename)** — the existing `EditableChapterTitle` behaviour is preserved. Renaming still works inline; the dropdown only opens from the ▾ affordance / chevron area, not from clicking into the title text while editing.
- **Keyboard shortcuts** — `Alt + ←` / `Alt + →` navigate prev/next chapter (ignored while typing in the editor / inputs). No shortcut for the picker to avoid clashing with the editor.

Save-state handling: navigation uses the same guard as the existing "Back" button — if there are unsaved edits, we prompt before switching, so nothing is lost mid-chapter.

## Where it lives

- New component: `src/components/projects/ChapterNavigator.tsx`
  - Props: `projectId`, `currentChapterId`, `onNavigate(chapterId)` (optional; defaults to `navigate('/dashboard/workspace/{id}')`).
  - Uses the existing `useProjectChapters(projectId)` hook — the query is already cached and lightweight (metadata-only columns), so opening the workspace won't refetch heavy content.
  - Renders nothing while loading or if there's only one chapter.

- `src/pages/Workspace.tsx`
  - In the `zenTitle` block, when `request.is_project_workspace && request.project_id`, render:
    - `‹` button
    - `EditableChapterTitle` with a `prefix` like `Ch. {order}.` (already supported) plus a new adjacent ▾ trigger that opens the `ChapterNavigator` popover
    - `›` button
  - Solo (non-project) drafts keep today's exact header.
  - Reuse the existing unsaved-changes confirmation before calling `navigate(...)`.

- `src/components/layout/DashboardLayout.tsx` — no structural change; `zenTitle` already accepts arbitrary React, so the navigator sits inside it naturally. On mobile the chevrons stay visible (icon-only, 32px hit target); the title truncates as it already does.

## Non-goals (kept out on purpose)

- No changes to the Project detail list, reordering, or the chapter schema.
- No prefetching of chapter content — navigation still loads the target workspace fresh, same as today.
- No changes to collab (multi-writer) workspaces — they aren't part of a book pipeline.
