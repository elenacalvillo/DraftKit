

## Fix: Public view link overflows the modal

**Root cause:** The link row sits inside `DialogContent` which has `sm:max-w-[460px]`, but the URL row uses `flex items-center gap-2` where the truncate child cannot shrink because its parent flex container itself doesn't constrain width properly when the URL is one unbroken string. The current code uses `truncate overflow-x-auto` on the same element — these conflict (`truncate` sets `overflow:hidden` + `white-space:nowrap`, killing the scroll). Also missing `min-w-0` on the flex parent chain, which is what actually allows truncation/scroll inside flex.

In production, tokens are full UUIDs (~36 chars) plus the custom domain `draftkit.app/view/<uuid>` ≈ 55 chars — short enough. But on `lovableproject.com` previews the host is ~50+ chars, pushing total length past 100 chars and breaking the layout.

### Fix in `src/components/requests/InviteCollaboratorModal.tsx` (lines ~234-252)

Replace the link row so it scrolls horizontally instead of truncating:

1. Wrap the URL in a single-line, horizontally scrollable container.
2. Remove `truncate` (it conflicts with `overflow-x-auto`).
3. Add `min-w-0` to the flex parent so the child can actually shrink.
4. Keep the copy button outside the scroll area as a fixed-width sibling.

**New structure:**
```tsx
<div className="flex items-center gap-2 min-w-0">
  <div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap text-xs font-mono text-muted-foreground rounded border border-border/50 bg-background/50 px-2 py-1.5 scrollbar-thin">
    {viewUrl}
  </div>
  <Button ... className="h-8 w-8 p-0 shrink-0">...</Button>
</div>
```

Also add `min-w-0` to the outer card `<div className="rounded-lg border ...">` if needed.

### Files
| File | Change |
|---|---|
| `src/components/requests/InviteCollaboratorModal.tsx` | Replace `truncate overflow-x-auto` row with proper `min-w-0` + `overflow-x-auto whitespace-nowrap` scrollable container |

### Out of scope
- Shortening tokens (UUIDs are required for entropy)
- URL shortener service

