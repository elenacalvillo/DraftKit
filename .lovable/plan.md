## Goal
Stop the floating editor toolbar from overflowing the screen on mobile. Keep desktop unchanged.

## Approach
On mobile (`< sm`), show only the essential formatting buttons inline, and tuck the rest behind a single "More" (`MoreHorizontal`) dropdown. On `sm+` the full toolbar renders as it does today.

## Mobile button split
**Always visible (mobile):**
- Heading dropdown (H1/H2/H3)
- Bold
- Italic
- Bullet list
- Link
- More menu (overflow)

**Inside the More menu (mobile only):**
- Strikethrough
- Inline code
- Code block
- Highlighter (sticky comment)
- Image upload (when available)
- Numbered list
- Divider
- Table (with its current submenu actions)

On `sm+`, all buttons render inline as today (no More menu).

## Implementation
Single file: `src/components/requests/WorkspaceEditor.tsx`

1. Add a `useIsMobile`-style check (already used elsewhere in the codebase) or a simple `matchMedia('(max-width: 639px)')` hook.
2. Wrap each currently-inline toolbar button in a class that hides it on mobile when it's in the "overflow" set: `hidden sm:inline-flex`.
3. Add a new `MoreHorizontal` `DropdownMenu` rendered only on mobile (`sm:hidden`) containing `DropdownMenuItem`s for each overflow action, each calling the same `editor.chain()...` command as its inline button.
4. Tighten toolbar padding on mobile: `px-2 py-1.5 gap-0` on `< sm`, current `px-3 py-2 gap-0.5` on `sm+`.
5. Constrain the pill width so it never exceeds viewport: add `max-w-[calc(100vw-1rem)]` to the portaled container.
6. Remove the inline vertical dividers on mobile (`hidden sm:block`) since the compact set doesn't need them.

## Out of scope
- No changes to editor behavior, commands, sanitization, image upload pipeline, or any business logic.
- No changes to `SharedWorkspace.tsx`, `Workspace.tsx`, or the SMART chat bubble.
- No DB, RLS, or edge function changes.
