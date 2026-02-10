
# Click Booked Dates to Open Workspace

## What changes

When you click a booked collaboration date on the calendar, it navigates you to the shared workspace for that request.

## Files to change

### 1. CollabCalendar.tsx -- Add `requestId` to BookingInfo and `onBookedDateClick` callback

- Add `requestId: string` to the `BookingInfo` interface
- Add `onBookedDateClick?: (requestId: string) => void` to `CollabCalendarProps`
- In `handleDateClick`, when `status === "booked"` and `isEditable` is true, call `onBookedDateClick` with the request ID instead of doing nothing
- Change the booked date button from `cursor-default` to `cursor-pointer` when `onBookedDateClick` is provided

### 2. Availability.tsx -- Pass request IDs and handle navigation

- Include `id` in the `collab_requests` select query (line 83)
- Add `requestId` to the `BookingInfo` mapping (line 93)
- Pass `onBookedDateClick` to `CollabCalendar` that calls `navigate('/dashboard/workspace/{requestId}')`

### 3. Dashboard.tsx -- Same changes for the dashboard calendar

- Include `id` in the dashboard's collab_requests query
- Add `requestId` to its local `BookingInfo` interface and mapping
- Pass `onBookedDateClick` to `CollabCalendar` that navigates to the workspace

## Technical details

| File | Change |
|------|--------|
| `src/components/calendar/CollabCalendar.tsx` | Add `requestId` to `BookingInfo`, add `onBookedDateClick` prop, call it on booked date click |
| `src/pages/Availability.tsx` | Fetch `id` from requests, map to `BookingInfo.requestId`, pass navigation handler |
| `src/pages/Dashboard.tsx` | Same as Availability -- fetch ID, map it, pass navigation handler |

No database or backend changes needed.
