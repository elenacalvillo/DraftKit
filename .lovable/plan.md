
# Fix: Complete Timezone Date Shift Bug

## Problem Summary

You selected **April 3rd** in the calendar, but Dinah sees "**Thu, Apr 2, 2026**" in her dashboard. The database correctly stores `2026-04-03`, but the display is shifting the date backward by one day.

**Root Cause:** Multiple files are still using `new Date(dateString)` which interprets dates as UTC midnight, causing a backward shift for users in western timezones.

---

## Scope of the Bug

The `parseDateString` fix was applied to some files, but missed several others:

| File | Lines | Issue |
|------|-------|-------|
| `src/pages/Dashboard.tsx` | 121, 355 | "This Month Collabs" calculation and date display |
| `src/pages/MyRequests.tsx` | 260 | Guest's view of their sent requests |
| `supabase/functions/send-collab-email/index.ts` | 238 | Email notifications show wrong date |
| `supabase/functions/send-collab-reminder/index.ts` | 67, 71 | Reminder timing could fire on wrong day |

---

## Solution

Apply the same `parseDateString` pattern to all remaining locations. For edge functions (Deno environment), we'll add the helper function inline since they don't share code with the frontend.

---

## Files to Modify

### 1. src/pages/Dashboard.tsx

**Line 121** - This Month Collabs calculation:
```typescript
// Before
const date = new Date(r.requested_date);

// After
const date = parseDateString(r.requested_date);
```

**Line 355** - Date display in request list:
```typescript
// Before
{new Date(request.requested_date).toLocaleDateString()}

// After  
{parseDateString(request.requested_date).toLocaleDateString()}
```

Also add import at top of file:
```typescript
import { parseDateString } from "@/lib/utils";
```

---

### 2. src/pages/MyRequests.tsx

**Line 260** - Guest's sent requests view:
```typescript
// Before
{format(new Date(request.requested_date), 'MMM d, yyyy')}

// After
{format(parseDateString(request.requested_date), 'MMM d, yyyy')}
```

Also add import:
```typescript
import { parseDateString } from "@/lib/utils";
```

---

### 3. supabase/functions/send-collab-email/index.ts

Add helper function and fix date formatting:

```typescript
// Add helper function (Deno environment, can't import from @/lib)
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Line 238 - Before
const formattedDate = requestedDate 
  ? new Date(requestedDate).toLocaleDateString("en-US", {...})
  : "Flexible date";

// After
const formattedDate = requestedDate 
  ? parseDateString(requestedDate).toLocaleDateString("en-US", {...})
  : "Flexible date";
```

---

### 4. supabase/functions/send-collab-reminder/index.ts

Add helper function and fix date comparisons:

```typescript
// Add helper function
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Lines 67-71 - Before
const requestedDate = new Date(request.requested_date);
const reminderDate = new Date(requestedDate);

// After
const requestedDate = parseDateString(request.requested_date);
const reminderDate = new Date(requestedDate);
```

---

## Summary of Changes

| Location | Impact |
|----------|--------|
| Dashboard | Fixes date display in request previews + stats accuracy |
| MyRequests | Fixes guest's view of their sent request dates |
| Email Function | Fixes all email notifications showing correct date |
| Reminder Function | Ensures reminders fire on correct day |

---

## After This Fix

- Dinah will see "Fri, Apr 3, 2026" (the correct date you selected)
- All emails will show correct dates
- The "This Month Collabs" stat will calculate correctly
- Reminders will trigger on the right day
