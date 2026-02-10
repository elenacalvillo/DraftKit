

# Fix Zen Mode: Toolbar Visibility, Horizontal Overflow, and Layout

## What went wrong

From the screenshot, three problems are visible:

1. **The editor toolbar vanishes on scroll** -- it scrolls away instead of staying pinned below the zen header.
2. **Horizontal scrollbar appeared** -- the two-column grid (320px sidebar + editor) combined with page padding overflows the viewport.
3. **The left context panel shouldn't be visible during editing** -- in "full focus" zen mode, showing the partner card and buttons beside the editor wastes horizontal space and causes the overflow.

## Root cause

The workspace page uses `grid-cols-[320px_1fr]` inside a `max-w-6xl` container with `p-6 xl:p-10` padding. This worked fine with the old sidebar layout (which gave `ml-64` on desktop), but in zen mode the content area is now full-width, yet the two-column grid with fixed 320px still creates awkward proportions and overflow on smaller screens.

More importantly, the editor toolbar has `sticky top-[48px]` but the parent container structure prevents it from actually sticking (the `overflow-hidden` on the card wrapper clips it).

## The fix (3 files)

### 1. SharedWorkspace.tsx -- Remove overflow-hidden from wrapper

The root `div` has `overflow-hidden` which prevents `position: sticky` from working on the toolbar inside.

**Change:** Replace `overflow-hidden` with `overflow-visible` on the outer wrapper div so the sticky toolbar can stick to the viewport.

### 2. WorkspaceEditor.tsx -- Confirm sticky toolbar setup

The toolbar already has `sticky top-[48px] z-10`. Add a `bg-card` (or `bg-background`) class so the toolbar has an opaque background when content scrolls behind it. This prevents text bleeding through.

### 3. Workspace.tsx -- Collapse the two-column layout when editing

The left context panel (partner card, buttons) is useful context but should not compete with the editor for space. Two options, and I recommend Option A:

**Option A -- Hide the left panel entirely in zen mode on smaller screens:**
- On `lg` and above: keep the two-column grid as-is (there's enough room).
- Below `lg`: stack vertically, but move the context panel below the editor (or collapse it into an expandable section).
- Reduce the fixed `320px` column to `280px` to reclaim space.

**Option B -- Make the left panel collapsible:**
- Add a toggle button in the zen header to show/hide the context sidebar.
- Default to hidden so the editor gets full width.

I recommend **Option A** as it's simpler and matches the "clear the decks" philosophy.

Additionally, add `overflow-x-hidden` to the main content wrapper in `DashboardLayout.tsx` to prevent any horizontal scroll as a safety net.

### 4. DashboardLayout.tsx -- Add overflow protection

Add `overflow-x-hidden` to the zen mode main content area to prevent horizontal scrollbar.

## Files changed

| File | Change |
|------|--------|
| `src/components/requests/SharedWorkspace.tsx` | Remove `overflow-hidden` from root div so sticky toolbar works |
| `src/components/requests/WorkspaceEditor.tsx` | Add opaque background (`bg-card`) to sticky toolbar so content doesn't bleed through |
| `src/pages/Workspace.tsx` | Reduce fixed column from `320px` to `280px`; ensure proper stacking on mobile |
| `src/components/layout/DashboardLayout.tsx` | Add `overflow-x-hidden` to zen mode main wrapper |

No database, edge function, or dependency changes needed.
