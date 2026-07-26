## Tighten the sticky header spacing in `SharedWorkspace.tsx`

The current two-row header (~lines 720-860) leaves a visible white strip above the actions row and an uneven vertical gap between the actions row and the info row (label + save pill). Cause: row 1 uses `pt-2 sm:pt-2.5`, row 2 uses `pb-2 sm:pb-2.5 pt-1.5`, and the action buttons are `h-8/h-9` — so the top padding + button height create a tall band above the buttons and an asymmetric gap below them.

### Change (presentation-only)

In the sticky container at line 720:

- Keep the two-row `flex flex-col` structure and all buttons/handlers/gating untouched.
- Row 1 (actions): change `pt-2 sm:pt-2.5` → `pt-1.5`. Keep `px-3 sm:px-4`, `justify-end`, gaps. This removes the white strip above the buttons.
- Row 2 (info): change `pb-2 sm:pb-2.5 pt-1.5` → `pb-1.5 pt-0.5`. Tightens the gap between the buttons row and the "Shared Workspace · Saved…" line so the two rows read as one compact header.
- No changes to button heights, icons, labels, or the label/pill markup itself.

Result: no dead white band above the actions, and the info row sits snug (~2px) under the actions row instead of floating with a large gap.

### Out of scope

- No changes to any handler, gating, save logic, or the info row's content.
- No changes outside the sticky header block.

### Verification

- Visual check at ~1246px (current viewport) and mobile: no white strip above actions; info row sits tight under actions.
- Buttons and save-pill still render on their own lines without wrapping.
- Typecheck passes.