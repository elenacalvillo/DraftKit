

# Fix Text Contrast in Availability Instructions

## Problem
The current instructions use colored text (`text-available`, `text-booked`) which creates poor contrast and is hard to read. Additionally, the text says "purple" when the actual booked color is coral/soft red.

**Current Issues:**
1. `text-available` (bright green) applied directly to text - poor readability
2. `text-booked` (coral) applied directly to text - poor readability  
3. Text says "purple" but the actual color is coral/soft red

## Solution
Use the same pattern as the calendar legend: colored indicator squares with readable text labels.

**Pattern to follow (from CollabCalendar.tsx legend):**
```tsx
<div className="w-3 h-3 rounded-full bg-available" />
<span className="text-sm text-muted-foreground">Available</span>
```

---

## Files to Modify

| File | Location | Change |
|------|----------|--------|
| `src/pages/Availability.tsx` | Lines 233-236 | Replace colored text with indicator squares |
| `src/pages/Availability.tsx` | Lines 251-254 | Replace colored text with indicator squares |

---

## Detailed Changes

### 1. "How to use" Instructions (Lines 233-236)

**Current:**
```tsx
<li>Click on a date to mark it as <span className="text-available font-medium">open for publishing</span></li>
<li>Dates with <span className="text-booked font-medium">purple</span> background are already booked</li>
```

**Proposed:**
```tsx
<li>Click on a date to mark it as <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-available inline-block" />open for publishing</span></li>
<li>Dates with <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-booked inline-block" />coral</span> background are already booked</li>
```

### 2. "What guests will see" Card (Lines 251-254)

**Current:**
```tsx
<p>Guests will pick from your <span className="text-available font-medium">green dates</span> as a target publish date...</p>
```

**Proposed:**
```tsx
<p>Guests will pick from your <span className="inline-flex items-center gap-1.5 align-baseline"><span className="w-2.5 h-2.5 rounded bg-available inline-block" /><span className="font-medium">highlighted dates</span></span> as a target publish date...</p>
```

---

## Visual Comparison

**Before:**
```
• Click on a date to mark it as [open for publishing] ← bright green text, hard to read
• Dates with [purple] background are already booked  ← wrong color name + poor contrast
```

**After:**
```
• Click on a date to mark it as [■] open for publishing ← green square + readable text
• Dates with [■] coral background are already booked   ← coral square + correct name + readable text
```

---

## Technical Notes

1. Using `inline-flex items-center gap-1.5` to align the square with the text baseline
2. Using `w-2.5 h-2.5 rounded` for a small square that matches the calendar aesthetic
3. Using `inline-block` to ensure the square displays correctly within inline text
4. Changing "purple" to "coral" to match the actual `--booked` color (hsl 8 65% 65%)
5. Changing "green dates" to "highlighted dates" since the square already shows the color

