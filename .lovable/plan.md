

## Fix: Reschedule date picker not working + Add reschedule to Workspace

Two issues to fix:

### 1. RequestCard reschedule picker is broken

The Popover at line 466 only renders when `showReschedulePicker` is true, but then requires a *second* click on the PopoverTrigger button to open. The user clicks "Reschedule" in the menu, sees a button appear, but nothing else happens automatically.

**Fix**: Remove the Popover wrapper entirely. Render the Calendar inline when `showReschedulePicker` is true, with a Cancel button. This is simpler and guaranteed to work:

```tsx
{showReschedulePicker && isApproved && !isPastCollab && (
  <div className="p-4 border rounded-lg bg-muted/50">
    <p className="text-sm font-medium mb-2">Pick a new date</p>
    <Calendar
      mode="single"
      selected={undefined}
      onSelect={(date) => {
        if (date) {
          onReschedule?.(request.id, formatDateString(date));
          setShowReschedulePicker(false);
        }
      }}
      disabled={(date) => date < today}
      className="p-3 pointer-events-auto"
    />
    <Button variant="ghost" size="sm" onClick={() => setShowReschedulePicker(false)}>
      Cancel
    </Button>
  </div>
)}
```

**File**: `src/components/requests/RequestCard.tsx` — replace lines 464-496

### 2. Add reschedule button to Workspace page

On the Workspace page (`src/pages/Workspace.tsx`), next to the date display (line 664-672), add a small calendar icon button that opens the same inline date picker — but only for the **creator** viewing an approved, upcoming collab.

**Changes to `src/pages/Workspace.tsx`**:
- Import `CalendarDays` icon, `Calendar` component (rename existing Calendar icon import to avoid conflict)
- Add `showReschedulePicker` state
- Add `handleReschedule` function (same availability-swap logic as in Requests.tsx — update request date, restore old slot, claim new slot, send email)
- Next to the date `<span>`, render a small `CalendarDays` icon button for creator + approved + upcoming collabs
- Below the date row, conditionally render the inline Calendar picker

### Technical notes
- The `handleReschedule` in Workspace.tsx will duplicate the availability-swap logic from Requests.tsx (update `collab_requests.requested_date`, swap `availability.available_dates`, fire `send-collab-email`). This is acceptable since both pages operate independently.
- Only the **creator** (not guest) sees the reschedule button in the Workspace.

