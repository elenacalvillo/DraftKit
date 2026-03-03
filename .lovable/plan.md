

## Fix: Reschedule calendar styling for both RequestCard and Workspace

The problem: Both calendars render as full-size inline blocks that look cramped on mobile (overflows the card) and oversized on desktop. The Workspace sidebar has limited space, making the full calendar feel bloated.

### Solution: Use a Dialog (modal) instead of inline rendering

Replace the inline `<Calendar>` blocks in both places with a small **Dialog** modal. This:
- Works perfectly on both mobile and desktop
- Doesn't distort the card layout or sidebar
- Feels intentional and clean, not "shoved in"

### Changes

**1. `src/components/requests/RequestCard.tsx` (lines 464-491)**
- Replace the inline `<div>` + `<Calendar>` with a `<Dialog>` controlled by `showReschedulePicker`
- Dialog content: compact title "Reschedule collaboration", the Calendar component, and a Cancel button
- Calendar gets `className="mx-auto"` for centering
- Dialog closes on date selection or Cancel

**2. `src/pages/Workspace.tsx` (lines 725-751)**
- Same change: replace inline calendar with a `<Dialog>`
- Compact dialog with title "Reschedule" and the Calendar
- Closes on selection or Cancel

### UI result
- Clicking "Reschedule" (menu item or calendar icon) opens a clean centered modal with the date picker
- No layout distortion on mobile or desktop
- Consistent experience in both locations

