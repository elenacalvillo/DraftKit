Two targeted mobile UI fixes for the chapter list in ProjectDetail.

### 1. Compact the mobile stage dropdown
- The mobile Select currently uses `flex-1 h-9`, making it stretch the full width of the card row.
- Replace `flex-1` with an explicit compact width: `w-[140px]` (or `w-auto` + `min-w-[120px]`).
- Keep the mobile-only row layout (`sm:hidden flex items-center gap-2 w-full pl-6`) but let the Select take only the space it needs instead of dominating the card.
- The "Assign writer" hint should remain beside it without wrapping.

### 2. Increase vertical spacing between chapter cards on mobile
- The chapter list wrapper currently uses `space-y-2` universally.
- Change to responsive spacing: `space-y-4 sm:space-y-2`.
  - Mobile: 16px gap gives thumbs room so users don’t touch adjacent cards.
  - Desktop: keeps the tighter 8px gap to avoid excessive whitespace in long lists.

### File changed
- `src/pages/ProjectDetail.tsx` — adjust the `SelectTrigger` width and the list wrapper spacing classes.

No DB, RLS, or hook changes.