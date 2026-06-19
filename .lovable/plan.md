
# Mobile Workspace Redesign

The current `/workspace/:id` route is a desktop two-column layout (`grid lg:grid-cols-[280px_1fr]`) crammed into 420 px. On mobile the entire left sidebar — Partner card, dates, action buttons, Writer's Room, and the Conversation feed — stacks ABOVE the editor. Users have to scroll past an empty "No messages yet" card just to reach their draft. The editor toolbar then horizontally overflows ("Push to Substack" is cut off), and the floating SMART chat bubble sits on top of the prose.

This plan reshapes the mobile experience around one rule: **the draft is the page**. Everything else collapses behind explicit affordances.

## What changes on mobile (< `sm` / < 640 px)

### 1. Editor first, context second
- Reverse the stacking order on mobile so `SharedWorkspace` renders first and the left context column renders second (still first on `lg`+).
- The Conversation feed leaves the always-on context column on mobile. It moves into a bottom Sheet, opened by a dedicated icon button. This kills the empty "Start the conversation!" card eating the top of the screen.

### 2. Compact zen header
- Truncate the title with `min-w-0 truncate max-w-[55vw]` so "Drafting: Lo que Dylan calcula en la oscuridad" stops pushing the pencil icon off-screen.
- "Back" stays as an icon-only chevron on mobile (label hidden), reclaiming horizontal space.
- The Save/Cancel portal buttons collapse to icon-only on `< sm` (label hidden, `aria-label` preserved).

### 3. Workspace toolbar (`SharedWorkspace.tsx` header row)
Currently 5 buttons (Copy, Push to Substack, Download, Share, Edit Draft) sit in one flex row and overflow.

On mobile:
- **Primary action** stays inline as a single full-width button: `Edit Draft` when not editing, `Save & Sync` when editing.
- **Secondary actions** (Copy, Push to Substack, Download, Share) collapse into a single overflow `DropdownMenu` triggered by a `MoreHorizontal` icon button. Each item keeps its icon + label inside the menu, so destructive-adjacent actions are no longer one mis-tap away.
- The "Shared Workspace" label and `SaveStatusPill` collapse to just the pill on mobile (the label is redundant inside a zen workspace).
- Toolbar uses `sticky top-0` with backdrop blur so the primary action stays reachable while scrolling long drafts.

### 4. Floating context drawer
Replace the always-rendered left column with a bottom-anchored action bar on mobile containing 3 icon buttons:
- **Details** (Users icon) — opens a Sheet with Partner/Solo card, date, reschedule, Writer's Room, and the destructive "Delete Chapter / Cancel Collab" action (with its existing confirmation).
- **Conversation** (MessageSquare icon, with unread dot) — opens a Sheet with `WorkspaceConversation`.
- **SMART Draft** (Sparkles icon, creator only) — opens the existing draft modal.

The bar is `fixed bottom-0` with safe-area padding (`pb-[env(safe-area-inset-bottom)]`), `bg-card/95 backdrop-blur`, and a top border. Editor adds `pb-20` on mobile to clear it.

### 5. SMART chat floating bubble
- Reposition `bottom-20 right-4` on mobile (above the new action bar) instead of `bottom-4 right-4`, so it stops covering the last paragraph of prose.
- Already hidden behind a toggle; no behavior change beyond placement.

### 6. Editor-screen safety
- The Retrospective banner, "Active Editors" banner, and CollabImpactCard stay above the editor but become `glass-card p-3` (instead of `p-5`) on mobile to reduce scroll distance to the draft.
- The "Original Message" quote block moves into the Details sheet on mobile — it's reference, not workflow.

## Desktop behavior
Unchanged. All mobile-only rules are gated by `sm:`/`lg:` Tailwind breakpoints or a `useIsMobile` check for the bottom action bar (which renders `null` on `sm`+).

## Files touched
- `src/pages/Workspace.tsx` — reorder grid stacking, hoist Conversation/Details/Original Message into Sheets, add bottom action bar, compact zen header title, shrink banners on mobile.
- `src/components/requests/SharedWorkspace.tsx` — collapse secondary toolbar buttons into a `DropdownMenu` on mobile, make primary action full-width, sticky toolbar, hide "Shared Workspace" label on mobile, icon-only header portal buttons on mobile.
- SMART chat bubble component (search `bottom-4 right-4` in `src/components/`) — adjust mobile offset.
- No DB, RLS, edge function, or business-logic changes. No new dependencies (Sheet, DropdownMenu, useIsMobile already in the project).

## Out of scope
- Editor formatting toolbar (Tiptap floating pill) — already mobile-tracked per existing memory.
- Tablet (`sm` to `lg`) keeps current two-column behavior; only true mobile changes.
- No new features, no terminology changes, no metric logic.
