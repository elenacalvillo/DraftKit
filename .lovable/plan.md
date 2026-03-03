

## Highlight booked dates + prevent double-booking in reschedule calendar

### Problem
The reschedule date picker is a plain calendar with no awareness of which dates are already booked or available. A creator could accidentally reschedule onto an already-taken date, causing a conflict.

### Solution

**1. Pass booked dates into both reschedule calendars**

In `src/pages/Requests.tsx`:
- Already has `requests` state with all collab requests. Extract booked dates: `requests.filter(r => r.status === 'approved' && r.requested_date).map(r => r.requested_date)`
- Pass `bookedDates` as a new prop to `RequestCard`

In `src/pages/Workspace.tsx`:
- Fetch the creator's other approved requests (already has `request` data; need a small query for sibling booked dates)
- Pass booked dates into the Calendar's `disabled` + `modifiers`

**2. Update `RequestCard` props**
- Add `bookedDates?: string[]` prop
- In the Calendar inside the Dialog, use `modifiers` and `modifiersClassNames` to highlight booked dates in coral/red
- Add booked dates to the `disabled` callback so they **cannot be selected**

**3. Calendar styling for both locations**

Use the Calendar's `modifiers` API:
```tsx
<Calendar
  modifiers={{
    booked: bookedDates.map(d => parseDateString(d)),
  }}
  modifiersClassNames={{
    booked: "bg-destructive/20 text-destructive line-through",
  }}
  disabled={(date) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const dateStr = formatDateStr(date);
    return date < today || bookedDates.includes(dateStr);
  }}
/>
```

This makes booked dates visually coral/red with a strikethrough and **unclickable**, preventing conflicts entirely.

**4. Files changed**

- `src/components/requests/RequestCard.tsx` — add `bookedDates` prop, apply modifiers + disabled logic to Calendar
- `src/pages/Requests.tsx` — compute bookedDates from `requests` state, pass to each `RequestCard`
- `src/pages/Workspace.tsx` — fetch sibling booked dates, apply same modifiers + disabled logic to Calendar

### What happens if someone tries to reschedule to a taken day?
They simply can't — the date is disabled (greyed out with coral highlight). No conflict possible.

