# Fix custom date range, add All time, add CSV export

## What is wrong now

In the analytics range picker, "Custom range…" opens a calendar attached to an invisible trigger, rendered while the dropdown menu is still closing. The menu's focus return immediately counts as an outside interaction, so the calendar closes before a date can be picked.

There is also no way to see the whole history at once, and no way to pull the raw numbers out of the page.

## What changes

1. **Custom range picker works**
   - Move the two-month calendar into a proper modal dialog instead of a popover hung off a hidden trigger.
   - Open the dialog only after the dropdown has fully closed, so nothing steals focus from it.
   - Keep the same behaviour: pick a start day, pick an end day, Apply. Cancel leaves the current range untouched.

2. **All time option**
   - New "All time" entry at the top of the quick ranges. It runs from the first recorded event (10 January 2026) through now, labelled "All time".
   - Because the window is long, the chart automatically groups by week rather than day, matching how the picker already handles ranges over 90 days.
   - No previous-period comparison is meaningful here, so delta text reads "vs no prior period" and the delta arrows are hidden for this range.

3. **CSV download**
   - A "Download CSV" button next to the range picker exports every event in the currently selected range: date/time, event type, event details, page, and an anonymised user reference.
   - The file downloads straight from the browser, named after the range, for example `draftkit-events-all-time.csv`.
   - Pick "All time" first to export everything.

## Technical notes

- `src/lib/analytics-range.ts`: add an `all-time` key resolving to a fixed epoch start (`2026-01-01T00:00:00Z`) through `now`, bucket forced to `week`, and a `comparable: false` flag on `ResolvedRange` so consumers can suppress deltas. Existing keys keep their current behaviour; extend `src/lib/__tests__/analytics-range.test.ts` with cases for the new key.
- `src/components/admin/AnalyticsRangePicker.tsx`: replace the `Popover` block with `Dialog` + `DialogContent`, drive it from state set inside `setTimeout(..., 0)` on the menu item click, keep `pointer-events-auto` on `Calendar`. Add the "All time" menu item.
- `src/pages/AdminAnalytics.tsx`: guard the delta components on `range.comparable`; skip the previous-window fetch when false. Add an export handler that reuses the existing paged `fetchEventsInRange` result already held in state, serialises to CSV with proper quote escaping, and triggers a Blob download. No new queries, no schema changes.
- `event_data` is JSON; it is stringified into a single quoted CSV column. `user_id` is emitted as a shortened hash prefix, not the raw UUID.
