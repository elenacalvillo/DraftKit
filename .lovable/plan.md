## Restoring Published Collaborations to the Calendar

### What's Broken and Why

There are two data fetching queries that power the calendar's "booked" (coral) dots — one in `Dashboard.tsx` (the main dashboard calendar) and one in `Availability.tsx` (the edit calendar). Both filter requests with `.eq('status', 'approved')` only. When a collab transitions to `published`, it vanishes from the calendar entirely.

**The exact lines causing the disappearance:**

- `Dashboard.tsx` line 105: `const approvedRequests = reqData.filter((r) => r.status === "approved");`
- `Availability.tsx` line 85: `.eq('status', 'approved')`

### The Visual Distinction

The `CollabCalendar` component currently has one "booked" state (coral background, full opacity). To distinguish **published** (done) from **approved** (upcoming), we'll add a `publishedDates` prop with its own visual treatment:

- **Approved (upcoming):** Existing coral background — full color, avatar badge, navigable
- **Published (done):** Same coral color but at **50% opacity** + a small checkmark badge instead of the avatar, clearly reading as "completed"

This keeps the calendar as a true timeline — you see your full track record at a glance, with visual weight on what's still active.

### Files to Change


| File                                         | Change                                                                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/calendar/CollabCalendar.tsx` | Add `publishedDates` prop + `publishedBookingDetails` prop. Add `"published"` status to `getDateStatus()`. Style published dates with 50% opacity + check badge. Make published dates clickable (navigate to workspace). Update legend. |
| `src/pages/Dashboard.tsx`                    | Fetch both `approved` and `published` requests. Pass approved ones as `bookedDates` and published ones as `publishedDates` (with their own `BookingInfo` arrays).                                                                       |
| `src/pages/Availability.tsx`                 | Change the query from `.eq('status', 'approved')` to `.in('status', ['approved', 'published'])`. Show both on calendar — published with the completed visual.                                                                           |


### Precise Changes

`**CollabCalendar.tsx**`

- Add `publishedDates?: string[]` and `publishedBookingDetails?: BookingInfo[]` to props interface
- In `getDateStatus()`: check `publishedDates` before `bookedDates` (priority order: published → booked → blocked → available → default)
- In the day button render: for `status === "published"`, apply `bg-booked/10 text-booked opacity-60 cursor-pointer` + a tiny `✓` checkmark badge (replacing the avatar badge)
- In the tooltip for published dates: show "View published workspace →" text
- In the legend: add a "Published" entry with a faded coral dot + checkmark

`**Dashboard.tsx**`

- Change the filter on line 105 from `status === "approved"` to include both
- Create two separate arrays: `approvedRequests` (status approved) and `publishedRequests` (status published)
- Pass `publishedDates` and `publishedBookingDetails` to `CollabCalendar`

`**Availability.tsx**`

- Change `.eq('status', 'approved')` to `.in('status', ['approved', 'published'])`
- Separate the results into approved vs published arrays
- Pass both to `CollabCalendar`

No database changes. No new dependencies. No edge function changes.

### A Small Color Tweak for the "Brand"

We discussed moving away from "ugly bright colors" for the badges. Let's make sure that the **Checkmark Badge** on the calendar isn't a neon green.

- **Suggestion:** Keep the checkmark white or a very dark grey (`#2a2318`) inside a small circle. It keeps the aesthetic grounded and editorial.