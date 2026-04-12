

# Fix Footer Layout: Stacked Sections Instead of Single Row

## Problem

The footer crams logo, 5 links, and the copyright line into one horizontal row. On desktop it's tight; on tablets/smaller screens the links wrap awkwardly and overlap.

## Solution

Change the layout to a **3-row stacked footer** that centers everything and breathes properly at all sizes:

```text
Row 1:  [Logo]  DraftKit — The engine for creators who ship together
Row 2:  Privacy Policy · Terms · Refunds · How we protect you · Contact
Row 3:  Built with ❤ by Elena Calvillo 📖 · © 2026
```

### Layout Details

- **Container**: `flex flex-col items-center gap-6 text-center` — always stacked, always centered
- **Links row**: `flex flex-wrap items-center justify-center gap-x-6 gap-y-2` — wraps gracefully on small screens instead of overflowing
- **Copyright row**: stays as-is, centered

No `md:flex-row` — the footer stays vertically stacked at all breakpoints for clean alignment.

## File

| File | Change |
|------|--------|
| `src/components/layout/Footer.tsx` | Replace the single-row `flex-col md:flex-row` layout with a stacked `flex-col items-center` layout; add `flex-wrap` and `justify-center` to the links row |

