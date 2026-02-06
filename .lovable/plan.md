
# Scrub "Availability" Terminology from Async Mode Views

## Problem
The word "Availability" still appears in several places when creators are in async mode, reinforcing the meeting/scheduling mental model we're trying to avoid.

## Locations to Update

| File | Line | Current Text | Proposed Text (Async Mode) |
|------|------|-------------|---------------------------|
| `src/pages/Dashboard.tsx` | 283 | `Edit Availability` button | `Edit Publishing Dates` |
| `src/pages/Dashboard.tsx` | 299 | `No availability set yet.` | `No publishing dates set.` |
| `src/pages/Availability.tsx` | 132 | Toast: `Availability updated` | `Publishing dates updated` |
| `src/pages/Availability.tsx` | 287 | Stats: `Available dates` | `Publishing dates` |

For discovery mode, the button and text should remain as-is since "Availability" makes sense for call scheduling.

---

## Detailed Changes

### 1. Dashboard.tsx - Mode-Aware Button Text

**Line 283** - Update button to be mode-aware:

```tsx
<Button 
  variant="outline" 
  size="sm" 
  onClick={() => navigate('/dashboard/availability')}
>
  {creator.collab_mode === 'discovery' ? 'Edit Availability' : 'Edit Publishing Dates'}
</Button>
```

### 2. Dashboard.tsx - Mode-Aware Empty State

**Line 299** - Update the bold heading text:

```tsx
<span className="font-medium text-foreground">
  {creator.collab_mode === 'discovery' ? 'No availability set yet.' : 'No publishing dates set.'}
</span>
```

Also update `emptyStateText` (lines 177-179) to remove redundant "No availability set yet" since we're now handling it separately.

### 3. Availability.tsx - Mode-Aware Toast

**Line 132** - Update the success toast:

```tsx
toast.success(
  creator.collab_mode === 'discovery' 
    ? "Availability updated" 
    : "Publishing dates updated"
);
```

### 4. Availability.tsx - Mode-Aware Stats Label

**Line 287** - Update "Available dates" stat label:

```tsx
<p className="text-sm text-muted-foreground">
  {creator.collab_mode === 'discovery' ? 'Available dates' : 'Publishing dates'}
</p>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Mode-aware button text, mode-aware empty state heading |
| `src/pages/Availability.tsx` | Mode-aware toast message, mode-aware stats label |

---

## Visual Comparison

### Dashboard (Async Mode) - Before vs After

**Before:**
```
[Your Publication Schedule]              [Edit Availability]
                                         ^^^^^^^^^^^^^^^^^^
                                         ❌ Wrong terminology

No availability set yet. Click 'Edit Availability'...
   ^^^^^^^^^^^^^^^            ^^^^^^^^^^^^^^^^^^^
   ❌ Wrong                   ❌ Wrong
```

**After:**
```
[Your Publication Schedule]              [Edit Publishing Dates]
                                         ^^^^^^^^^^^^^^^^^^^^^^
                                         ✅ Consistent

No publishing dates set. Click 'Edit Publishing Dates'...
   ^^^^^^^^^^^^^^^^^^        ^^^^^^^^^^^^^^^^^^^^^^^
   ✅ Matches mode           ✅ Consistent
```

### Availability Page Toast - Before vs After

**Before:** `✓ Availability updated`
**After:** `✓ Publishing dates updated`

---

## Why Mode-Aware?

Discovery mode creators ARE scheduling calls, so "availability" is the right term for them. Only async mode needs the terminology shift to "publishing dates" to match the "Publishing Windows" page title.

---

## Summary

4 text changes across 2 files to fully scrub "Availability" from async mode views while keeping it for discovery mode where it makes sense.
