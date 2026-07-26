# Split the Shared Workspace header bar

The sticky header in `src/components/requests/SharedWorkspace.tsx` (around lines 720-857) currently jams the "Shared Workspace" label, save status pill, Copy / Push to Substack / Download / Share / History buttons and the Edit Draft primary CTA into a single horizontal row. On narrower widths (like the screenshot) the save status wraps under the label and the action labels crash into each other — completely unreadable.

## Change

Split that single flex row into a two-row stack inside the same sticky container:

- **Row 1 — Actions (top)**
  - Right-aligned on desktop, full-width on mobile.
  - Contains: desktop inline action buttons (Copy, Push to Substack, Download, Share), the mobile overflow `DropdownMenu`, `headerExtras` slot (History button), and the primary Edit Draft / Start Writing / Add comments CTA.
  - Keep exact button components, handlers, icons, `data-testid`s, and gating conditions (`hasContent`, `canEdit`, `isCreator`, `isEditing`, etc.) unchanged.

- **Row 2 — Info (bottom)**
  - Contains the `FileText` icon + "Shared Workspace" label and the `SaveStatusPill`.
  - Save status renders inline on one line without wrapping since the row is no longer competing with 5 buttons for space.
  - Slightly muted / smaller visual weight (e.g. `text-xs text-muted-foreground` on the label wrapper, pill unchanged) since actions become the visual anchor.

## Layout details

- Outer sticky wrapper keeps `sticky top-12 z-30 border-b border-border/50 bg-muted/60 backdrop-blur ...` but drops `flex items-center justify-between` and becomes a vertical stack (`flex flex-col`).
- Row 1: `flex items-center justify-end gap-1.5 sm:gap-2 px-3 sm:px-4 pt-2 sm:pt-2.5`.
- Row 2: `flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pb-2 sm:pb-2.5 pt-1 min-w-0` — save pill can now truncate/relative-time cleanly.
- On mobile, keep the "Shared Workspace" label hidden (as today with `hidden sm:flex`) so row 2 is just the save pill; row 1 stays compact with overflow menu + primary CTA.

## Out of scope

- No changes to save logic, edit gating, push-to-substack behavior, history drawer, or any handler.
- No changes to `Workspace.tsx` or `headerExtras` contents.
- Purely a presentation refactor inside the existing sticky header block (~lines 720-857).

## Verification

- Visual check at ~900px width (matches the screenshot) and at mobile width: actions row on top, save status readable on its own line below.
- Editing, copy, push-to-substack, download, share, history, and Edit Draft all continue to work.
- Typecheck passes.
