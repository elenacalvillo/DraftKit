

# Fix Theme Preview Text Contrast + Compact Process Steps

## Issues Identified

### Issue 1: Theme Preview Card (ProfileStyleSection.tsx)
Looking at the screenshot and code:
- **Line 164**: Username text uses `text-white` which is invisible on ultra-bright 95% lightness backgrounds
- **Lines 156-163**: Avatar only shows initial letter (`creator?.name?.charAt(0)`) but doesn't use the user's profile image (`creator.profile_image_url`)

### Issue 2: Process Steps on Creator Profile (PublicBooking.tsx)
Looking at the screenshot vs homepage:
- **Current styling** (lines 682-687): Coral filled circle with white number, plain muted text - low contrast, looks chunky
- **Homepage styling**: White circles with subtle border and coral numbered text - high contrast, elegant

---

## Solution

### Part 1: Fix Theme Preview (ProfileStyleSection.tsx)

**Change the username text color** to use dark `text-foreground` instead of `text-white`:
```tsx
// Before
<div className="mt-2 text-sm font-medium text-white drop-shadow-md">

// After  
<div className="mt-2 text-sm font-medium text-foreground">
```

**Add profile image support** using the Avatar component:
```tsx
// Replace the letter-only avatar with a full Avatar that shows image when available
<Avatar className="w-12 h-12 ring-2 ring-white/50">
  <AvatarImage src={creator?.profile_image_url || undefined} />
  <AvatarFallback className="bg-background/90 text-foreground font-bold">
    {creator?.name?.charAt(0) || 'A'}
  </AvatarFallback>
</Avatar>
```

### Part 2: Restyle Process Steps (PublicBooking.tsx)

**New styling** - Match homepage aesthetic but compact:

| Property | Before | After |
|----------|--------|-------|
| Circle size | `w-8 h-8` | `w-8 h-8` (keep compact) |
| Circle style | Filled coral | White with subtle border (`bg-card border border-border`) |
| Number style | White text on coral | Coral text (`text-primary`) |
| Step 1 highlight | Filled coral | Same as others (consistent) |
| Connector | Flat gray bar | Subtle dashed or lighter |

**Updated markup:**
```tsx
<div className="flex items-center justify-center gap-4">
  {COLLAB_MODE_METADATA[creator.collab_mode].processSteps.map((step, index) => (
    <div key={step.step} className="flex items-center">
      <div className="flex flex-col items-center">
        {/* White circle with border, coral number - matches homepage */}
        <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">{step.step}</span>
        </div>
        <span className="text-xs text-muted-foreground mt-1.5 whitespace-nowrap">{step.label}</span>
      </div>
      {/* Chevron arrow connector like homepage */}
      {index < COLLAB_MODE_METADATA[creator.collab_mode!].processSteps.length - 1 && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-1 mb-4" />
      )}
    </div>
  ))}
</div>
```

---

## Visual Comparison

### Theme Preview
| Before | After |
|--------|-------|
| White "Elena Calvillo" invisible on light bg | Dark text readable on all themes |
| Letter initial only "E" | Shows actual profile photo |

### Process Steps
| Before | After |
|--------|-------|
| Coral filled circle with white "1" | White circle with coral "1" |
| Gray bar connector | Chevron arrow (like homepage) |
| Low contrast, chunky | High contrast, elegant |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/ProfileStyleSection.tsx` | Fix text color, add Avatar with profile image |
| `src/pages/PublicBooking.tsx` | Restyle process steps to match homepage aesthetic |

