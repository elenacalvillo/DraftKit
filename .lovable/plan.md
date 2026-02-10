

# Fix: Workspace Content Overflowing the Viewport

## Problem

The shared workspace content (both in view mode and edit mode) extends beyond the right edge of the screen. Long lines of text are not wrapping, causing the entire layout to overflow horizontally. The user can't see the right side of the content.

## Root Cause

Three missing constraints:

1. **SharedWorkspace root div** -- has no `overflow-hidden` on the content area (we removed it earlier to fix sticky toolbar, but now text overflows).
2. **The prose/editor content** -- no `overflow-wrap: break-word` or `max-width` to force long text to wrap.
3. **The grid column** -- the `1fr` column in the grid has no `min-width: 0` (a common CSS Grid gotcha where `1fr` defaults to `min-width: auto`, allowing children to push the column wider than the available space).

## Fix (3 files, surgical changes)

### 1. Workspace.tsx -- Add `min-w-0` to the right panel

The right column in the grid (`motion.div` wrapping `SharedWorkspace`) needs `min-w-0` to prevent the `1fr` column from expanding beyond viewport. This is the classic CSS Grid fix.

```
// Line 356: Add min-w-0 to the right panel motion.div
className="min-w-0"
```

Also add `min-w-0` to the outer grid container div (`max-w-6xl mx-auto`) to ensure nothing escapes.

### 2. SharedWorkspace.tsx -- Add `overflow-hidden` back, but only on the content areas (not the sticky toolbar parent)

The trick: keep the root wrapper without `overflow-hidden` (so sticky toolbar works), but add `overflow-hidden` to the **content display area** and constrain the prose.

- Add `overflow-hidden` to the view-mode prose div (line 225)
- Add `break-words` / `overflow-wrap: break-word` to the workspace-prose class

### 3. WorkspaceEditor.tsx -- Add word-wrap constraints to the editor

- Add `overflow-hidden` and `break-words` to the editor wrapper div
- Add `overflow-wrap: break-word` and `word-break: break-word` to the editor prose attributes so the Tiptap content wraps properly

## Technical Details

| File | Line(s) | Change |
|------|---------|--------|
| `src/pages/Workspace.tsx` | 356 | Add `min-w-0` to right panel `motion.div` |
| `src/components/requests/SharedWorkspace.tsx` | 225-226 | Add `overflow-hidden` and word-wrap to prose view area |
| `src/components/requests/WorkspaceEditor.tsx` | 54-56 | Add `overflow-wrap: break-word` to editor prose attributes |
| `src/components/requests/WorkspaceEditor.tsx` | 94 | Add `min-w-0 overflow-hidden` to editor flex container |

No database, dependency, or edge function changes needed.
