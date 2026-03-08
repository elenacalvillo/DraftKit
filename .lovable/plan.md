

## Tone down green in published collaboration cards

### Problem
The "This collaboration is published!" text and "View Final Workspace" button use `text-success` which resolves to a bright emerald green (`hsl(152, 69%, 45%)`) — too saturated and hard to read on light backgrounds.

### Solution
Change these two elements in `src/components/requests/RequestCard.tsx` (lines 655-669) to use the warm brand palette instead of the raw success green:

1. **"This collaboration is published!" text** (line 657): Replace `text-success` with `text-primary` (coral) — matches the brand and the sparkle emoji already suggests celebration
2. **"View Final Workspace" button** (line 663): Replace `border-success/30 text-success hover:bg-success/10` with `border-primary/30 text-primary hover:bg-primary/10` — coral outline button, consistent with the rest of the UI

This is a 2-line change scoped only to the published section. No global color changes needed.

### File changed
- `src/components/requests/RequestCard.tsx` — lines 657 and 663

