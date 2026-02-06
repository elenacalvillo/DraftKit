

# Fix Button Hover Contrast Issue

## Problem
The `outline` button variant on hover has poor text contrast. When hovered, it uses:
- Background: `hover:bg-accent` → `hsl(24 58% 60%)` (coral/orange)
- Text: `hover:text-accent-foreground` → `hsl(8 50% 35%)` (dark brown)

Both colors are warm-toned, creating insufficient contrast for readability.

## Solution Options

### Option A: Use White Text on Hover (Recommended)
Change the outline button hover to use `primary-foreground` (white) for text, similar to how `default` and `gradient` variants work. This provides high contrast on the coral background.

**Change in `src/components/ui/button.tsx`:**
```tsx
// Line 14 - Current:
outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",

// Proposed:
outline: "border border-input bg-background hover:bg-accent hover:text-primary-foreground",
```

### Option B: Keep Border Style on Hover (More Subtle)
Instead of filling the background, keep the outline style but just darken the border and text slightly.

**Change in `src/components/ui/button.tsx`:**
```tsx
// Line 14 - Current:
outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",

// Proposed:
outline: "border border-input bg-background hover:border-primary hover:text-primary",
```

### Option C: Use Lighter Background with Dark Text
Use a very light tint of the accent color so the dark text remains readable.

**Change in `src/components/ui/button.tsx`:**
```tsx
// Line 14 - Current:
outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",

// Proposed:
outline: "border border-input bg-background hover:bg-accent/20 hover:text-foreground",
```

---

## Recommendation

**Option A (white text on coral)** provides the strongest visual feedback while maintaining high contrast. This matches the pattern used by `default`, `gradient`, and `hero` variants.

**Option C (light tint)** is more subtle and keeps the outline button feeling "lighter" than primary buttons, which may be preferred for secondary actions.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/button.tsx` | Update line 14 - outline variant hover styles |

---

## Visual Comparison

**Current (poor contrast):**
```
[Edit Publishing Dates] ← coral bg + dark brown text = hard to read
```

**Option A - White text:**
```
[Edit Publishing Dates] ← coral bg + white text = high contrast ✓
```

**Option C - Light tint:**
```
[Edit Publishing Dates] ← light coral tint + dark text = subtle but readable ✓
```

