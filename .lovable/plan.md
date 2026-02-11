
# Fix Calendar Click Navigation and Email Reply-To

## Problem 1: Clicking booked dates on the Dashboard calendar does nothing

The calendar's click handler only processes booked-date clicks when `isEditable={true}` (used on the Availability page). The Dashboard calendar doesn't set `isEditable`, so booked dates are silently ignored.

**Fix:** Move the booked-date click handling to run in BOTH the editable and non-editable branches of `handleDateClick`.

**File:** `src/components/calendar/CollabCalendar.tsx`

- Extract the booked-date-click logic so it runs regardless of `isEditable`
- When a booked date is clicked and `onBookedDateClick` is provided, navigate to the workspace
- This means both Dashboard and Availability calendars will support clicking booked dates

## Problem 2: Email recipients can't reply directly to their collaborator

All notification emails currently set `reply_to: "hello@draftkit.app"`. When someone hits "Reply" in their email client, it goes to DraftKit support instead of their collaborator.

**Fix:** Set `reply_to` dynamically based on who the email is about:

- Emails TO the guest (from creator actions) -> `reply_to` = creator's email
- Emails TO the creator (from guest actions) -> `reply_to` = guest's email
- Service emails (reminders, receipts) -> keep `reply_to: "hello@draftkit.app"`

**File:** `supabase/functions/send-collab-email/index.ts`

- Update `sendEmail()` to accept an optional `replyTo` parameter
- For each email type, pass the appropriate collaborator email as `replyTo`:
  - `request_approved` -> reply_to = creatorEmail
  - `request_declined` -> reply_to = creatorEmail
  - `request_received` -> reply_to = requesterEmail
  - `request_submitted` -> keep hello@draftkit.app
  - `new_message` -> reply_to = creatorEmail
  - `new_message_from_guest` -> reply_to = requesterEmail
  - `collab_reminder` -> host email gets requesterEmail as reply_to, guest email gets creatorEmail
  - `collab_type_changed` -> reply_to = creatorEmail
  - `workspace_updated_by_creator` -> reply_to = creatorEmail
  - `workspace_updated_by_guest` -> reply_to = requesterEmail
  - `request_cancelled_by_guest` -> reply_to = requesterEmail
  - `collab_cancelled_by_host` -> reply_to = creatorEmail

## Technical summary

| File | Change |
|------|--------|
| `src/components/calendar/CollabCalendar.tsx` | Move booked-date click handling before the `isEditable` check so it works on both Dashboard and Availability |
| `supabase/functions/send-collab-email/index.ts` | Add `replyTo` parameter to `sendEmail()`, set it to the collaborator's email for each email type so recipients can reply directly |

No database or dependency changes needed.
