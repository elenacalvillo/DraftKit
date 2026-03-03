

## Add "Reschedule" to approved collaboration requests

### What this does
Adds a "Reschedule" option to approved collab request cards. When clicked, a date picker appears inline. Picking a new date:
1. Updates the `requested_date` on the collab request
2. Restores the old date to available slots (so another collaborator can book it)
3. Sends an email notification to the guest about the date change

No new database columns or tables needed — this only updates existing `requested_date` and `available_dates` fields.

### Changes

**1. `src/components/requests/RequestCard.tsx`**
- Add `CalendarDays` icon import and date-picker imports (Popover, Calendar from shadcn)
- Add `onReschedule` callback prop: `(id: string, newDate: string) => void`
- Add state for showing the reschedule date picker
- Add "Reschedule" item to the approved card's overflow dropdown menu (the `MoreHorizontal` menu, around line 338), between "Link External Doc" and "Generate SMART Draft"
- When clicked, show an inline date picker (Popover with Calendar) below the card header
- On date selection, call `onReschedule(request.id, newDateString)` and close the picker

**2. `src/pages/Requests.tsx`**
- Add `handleReschedule` function that:
  - Updates `collab_requests.requested_date` to the new date
  - Restores the old date to `availability.available_dates` (if it existed)
  - Removes the new date from `availability.available_dates` (if present)
  - Updates local state
  - Shows toast: "Rescheduled to [new date]. Old slot restored."
  - Fires `send-collab-email` with type `collab_rescheduled`
- Pass `onReschedule={handleReschedule}` to each `RequestCard`

**3. `src/lib/storage.ts`** — No changes needed (types already support `requestedDate` as nullable string)

### UI behavior
- Reschedule picker only appears on **approved, upcoming** cards (same condition as the overflow menu: `isApproved && !isPastCollab`)
- The Calendar component disables past dates
- After rescheduling, the card immediately reflects the new date
- The old calendar slot becomes available for new bookings

### Email notification
The existing `send-collab-email` edge function will need a new `collab_rescheduled` type handler — a simple addition to notify the guest that "Your collaboration has been rescheduled to [new date]."

