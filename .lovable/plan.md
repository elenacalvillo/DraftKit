

# Add Two-Way Messaging for Collaborators

Enable guests (requesters) to send messages to creators directly through the app, creating a complete two-way messaging experience without relying solely on email replies.

## Current State

- **Creator → Guest**: Creators can message guests via `SendMessageModal` on the Requests page. Messages are saved to `collaboration_messages` table and trigger an email notification to the guest.
- **Guest → Creator**: Currently, guests can only reply via email (using "Reply to [Creator]" button in notification emails). There's no in-app messaging UI for guests.
- **Database**: The `collaboration_messages` table exists with RLS policies already supporting requester inserts for their own requests.

## What Will Be Built

A new "Message" button on the **Sent Requests** page (`MyRequests.tsx`) that opens a modal for guests to send messages to creators. When sent:
1. Message is saved to the `collaboration_messages` table
2. Email notification is sent to the creator
3. Confirmation toast appears for the guest

## Implementation Approach

### 1. Create Guest Message Modal Component
A new `GuestMessageModal.tsx` component (similar to `SendMessageModal`) that:
- Accepts request details (request ID, creator name)
- Provides a textarea for composing messages
- Saves to `collaboration_messages` with `sender_type: "requester"`
- Triggers email notification to the creator

### 2. Add New Email Type for Guest Messages
Update the `send-collab-email` edge function to handle a new `new_message_from_guest` type that:
- Sends to the creator's email (from `creator_contacts` table)
- Includes the message content and guest details
- Has a "Reply" button linking to their dashboard requests page

### 3. Update Sent Requests Page
Add a "Message" button to each approved request card on the `MyRequests.tsx` page, which opens the new modal.

### 4. Update Authorization Rules
Add `new_message_from_guest: "requester"` to the edge function's role mapping so guests are authorized to trigger this email type.

## Technical Details

### New Files
- `src/components/requests/GuestMessageModal.tsx` - Modal for guests to compose and send messages

### Modified Files
- `src/pages/MyRequests.tsx` - Add Message button to approved request cards
- `supabase/functions/send-collab-email/index.ts` - Add `new_message_from_guest` email type and template

### Database
No schema changes needed - the existing `collaboration_messages` table and RLS policies already support this:
- Requesters can insert messages for their own requests (policy exists)
- Requesters can view messages for their own requests (policy exists)

### Edge Function Changes
1. Add new email type `new_message_from_guest` to the `EmailRequest` type
2. Add role mapping: `new_message_from_guest: "requester"`
3. Add email template that notifies the creator with:
   - Message content from the guest
   - Link to view the request in their dashboard
   - "Reply" button to respond via email

### UI Flow
1. Guest visits `/dashboard/my-requests`
2. On approved requests, a "Message [Creator Name]" button appears
3. Clicking opens `GuestMessageModal`
4. Guest types message and clicks "Send"
5. Message saves to database, email sent to creator
6. Toast confirms: "Message sent to [Creator Name]!"

