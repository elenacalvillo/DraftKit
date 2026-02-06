

# Fix Timezone-Related Date Shift Bug

## Problem

When a user selects **April 1st** in the calendar, the displayed "Target Publication Date" shows **March 31st**. This is a timezone bug affecting all users west of UTC.

### Root Cause

Date strings like `"2026-04-01"` are being parsed with `new Date(dateStr)`, which interprets them as **UTC midnight**. When the browser then displays this date using `toLocaleDateString()`, it converts to local time, causing the date to shift backwards for users in western timezones.

**Example flow:**
```text
1. User clicks April 1st
2. Calendar stores: "2026-04-01"
3. Display code runs: new Date("2026-04-01")
4. JavaScript interprets: 2026-04-01T00:00:00.000Z (UTC midnight)
5. User in Pacific Time (UTC-7): Converts to March 31, 2026 at 5:00 PM local
6. toLocaleDateString() outputs: "March 31, 2026" - WRONG!
```

---

## Solution

Parse date strings by splitting them into year/month/day components, then create a `Date` object with local time components. This ensures the date stays anchored to the user's local timezone.

### Helper Function

Create a reusable date parsing utility in `src/lib/utils.ts`:

```typescript
/**
 * Parse a YYYY-MM-DD date string without timezone shifting.
 * Uses local time components to prevent UTC conversion issues.
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `parseDateString()` helper function |
| `src/pages/PublicBooking.tsx` | Update `formatSelectedDate()` to use `parseDateString()` |
| `src/components/requests/RequestCard.tsx` | Update `formatDate()` to use `parseDateString()` |
| `src/components/calendar/CollabCalendar.tsx` | Update date comparisons in `firstAvailableDate` logic to use `parseDateString()` |

---

## Detailed Changes

### 1. src/lib/utils.ts

Add the helper function after the existing `cn` function:

```typescript
/**
 * Parse a YYYY-MM-DD date string without timezone shifting.
 * Uses local time components to prevent UTC conversion issues.
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
```

### 2. src/pages/PublicBooking.tsx (line 562-564)

**Before:**
```typescript
const formatSelectedDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { ... });
};
```

**After:**
```typescript
const formatSelectedDate = (dateStr: string) => {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString("en-US", { ... });
};
```

### 3. src/components/requests/RequestCard.tsx (line 86-89)

**Before:**
```typescript
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { ... });
};
```

**After:**
```typescript
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = parseDateString(dateStr);
  return date.toLocaleDateString("en-US", { ... });
};
```

### 4. src/components/calendar/CollabCalendar.tsx (lines 59-60)

**Before:**
```typescript
for (const dateStr of sortedDates) {
  const date = new Date(dateStr);
  if (date >= today) {
    return date;
  }
}
```

**After:**
```typescript
for (const dateStr of sortedDates) {
  const date = parseDateString(dateStr);
  if (date >= today) {
    return date;
  }
}
```

---

## Why This Works

When you call `new Date(year, month, day)` with numeric components, JavaScript creates a Date object in **local time**, not UTC. This means:

```text
parseDateString("2026-04-01")
→ new Date(2026, 3, 1)  // April 1st in LOCAL timezone
→ 2026-04-01T07:00:00.000Z (if UTC-7)
→ toLocaleDateString() shows "April 1, 2026" ✓
```

---

## Impact

This fix will correct date display across:
- Public booking page (date confirmation panel)
- Request cards in dashboard
- Calendar navigation (jumping to first available date)

All 17 creators and their visitors will see correct dates after this fix.

