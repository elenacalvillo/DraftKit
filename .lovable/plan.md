

# "Total Zen" Workspace — Clear the Decks

## Overview

Completely eliminate the sidebar and standard navbar when `zenMode` is active. Replace with a single, slim 48px header. The Tiptap toolbar sticks flush beneath it. The workspace gets 100% of the screen.

---

## 1. DashboardLayout.tsx — Kill All Chrome in Zen Mode

When `zenMode` is true:
- **Do NOT render** the sidebar (`<motion.aside>`) at all
- **Do NOT render** the mobile overlay
- **Replace** the mobile header with a slim 48px zen bar (on ALL screen sizes, not just mobile)
- **Main content**: No `ml-64` on desktop, no `pt-16` — just `pt-12` (48px) to sit below the slim zen header

The zen header renders a single fixed bar:
- **Left**: Back arrow icon (navigates to `zenBackPath`)
- **Center**: "Drafting with {partnerName}" in clean text
- **Right**: Empty spacer (keeps center text centered)

When `zenMode` is false, everything works exactly as before.

### Key change summary

```
// Zen mode = true:
// - Sidebar: not rendered
// - Mobile overlay: not rendered  
// - Header: slim 48px zen bar on ALL breakpoints
// - Main: pt-12, no ml-64

// Zen mode = false:
// - Everything unchanged
```

---

## 2. WorkspaceEditor.tsx — Sticky Top Adjustment

Change the toolbar sticky position from `top-0` to `top-[48px]` so it sits flush below the zen header. Since zen mode now applies on all screen sizes (no sidebar), this is consistent:

```
sticky top-[48px] z-10
```

On non-workspace pages the editor is never used, so this doesn't affect anything else.

---

## 3. Workspace.tsx — Update Zen Title

Change the zen title from `Workspace · {partnerName}` to `Drafting with {partnerName}` to make it feel collaborative and personal.

Also remove the redundant "Back to Requests" button inside the page content (the zen header already has a back button).

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/layout/DashboardLayout.tsx` | Conditionally skip sidebar/overlay rendering in zen mode; render slim 48px zen header on all breakpoints |
| `src/components/requests/WorkspaceEditor.tsx` | Change sticky toolbar to `top-[48px]` |
| `src/pages/Workspace.tsx` | Update zen title to "Drafting with ...", remove redundant back button |

No database, edge function, or CSS changes needed.

