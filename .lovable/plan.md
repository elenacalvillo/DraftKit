

## Clarify "Next Available Dates" Message Based on Collaboration Mode

The banner in the calendar currently says "Next available dates are in March 2026" but doesn't specify what those dates represent. This is confusing because:
- In **Async Workspace mode**: dates are for **publishing**
- In **Discovery First mode**: dates are for **calls/meetings**

---

### The Problem

**Current text:**
> Next available dates are in March 2026

**User's question:**
> "dates for what??? For publish? For taking calls?"

This is the same clarity issue we just fixed on the Public Booking page - we need mode-aware messaging.

---

### Solution

Pass the `collab_mode` to the calendar component and use it to generate context-aware messaging.

---

### Changes Overview

| Component | Change |
|-----------|--------|
| `CollabCalendar.tsx` | Add optional `collabMode` prop, update banner text to be mode-aware |
| `Dashboard.tsx` | Pass `creator.collab_mode` to the CollabCalendar component |
| `PublicBooking.tsx` | Pass `creator.collab_mode` to the CollabCalendar component |

---

### Updated Banner Text

| Mode | New Text |
|------|----------|
| `async` | "Next available **publication dates** are in March 2026" |
| `discovery` | "Next available **call slots** are in March 2026" |
| No mode set | "Next available dates are in March 2026" (fallback) |

---

### Implementation Details

**1. Update CollabCalendar interface (CollabCalendar.tsx):**

```tsx
interface CollabCalendarProps {
  // ... existing props
  collabMode?: 'async' | 'discovery' | null;
}
```

**2. Update banner text logic (CollabCalendar.tsx, around line 260):**

```tsx
// Determine mode-aware date label
const dateTypeLabel = collabMode === 'discovery' 
  ? 'call slots' 
  : collabMode === 'async' 
    ? 'publication dates' 
    : 'dates';

// In the banner:
<span>
  Next available <span className="font-medium">{dateTypeLabel}</span> are in{" "}
  <span className="font-medium text-primary">
    {monthNames[firstAvailableDate.getMonth()]} {firstAvailableDate.getFullYear()}
  </span>
</span>
```

**3. Pass collabMode from Dashboard.tsx:**

```tsx
<CollabCalendar
  availableDates={availability}
  bookedDates={bookedDates}
  bookingDetails={bookingDetails}
  collabMode={creator.collab_mode as 'async' | 'discovery' | null}
/>
```

**4. Pass collabMode from PublicBooking.tsx:**

```tsx
<CollabCalendar
  availableDates={availableDates}
  // ... other props
  collabMode={creator.collab_mode as 'async' | 'discovery' | null}
/>
```

---

### Visual Before/After

**Before (vague):**
```
Next available dates are in March 2026  [Jump there →]
```

**After - Async mode:**
```
Next available publication dates are in March 2026  [Jump there →]
```

**After - Discovery mode:**
```
Next available call slots are in March 2026  [Jump there →]
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/calendar/CollabCalendar.tsx` | Add `collabMode` prop, update banner text |
| `src/pages/Dashboard.tsx` | Pass `collabMode` prop to CollabCalendar |
| `src/pages/PublicBooking.tsx` | Pass `collabMode` prop to CollabCalendar |

