

# Add Feedback Email Notifications

When someone submits feedback through the widget, you'll receive an instant email notification so you never miss user input.

## What Will Be Built

A new backend function that sends you an email whenever feedback is submitted, including:
- The feedback type (bug, feature request, praise, etc.)
- Star rating (if provided)
- The full message content
- The page URL where they submitted
- The user's email (if provided) so you can reply

## Implementation Approach

### 1. Create New Backend Function
A new `send-feedback-notification` function will be created that:
- Receives feedback details (type, message, rating, email, page URL)
- Formats a clean HTML email with all the details
- Sends to your admin email using the existing Resend configuration

### 2. Update Feedback Widget
After successfully saving feedback to the database, the widget will call the new function to trigger the email notification. This happens in the background so users don't experience any delay.

### 3. Email Format
The notification email will include:
- Color-coded header based on feedback type (red for bugs, purple for features, etc.)
- Star rating visualization
- Full message content
- Quick "Reply" button if the user provided their email
- Page URL for context

## Technical Details

**New File:**
- `supabase/functions/send-feedback-notification/index.ts`

**Modified File:**
- `src/components/feedback/FeedbackWidget.tsx` - Add edge function call after database insert

**Configuration:**
- `supabase/config.toml` - Register new function with `verify_jwt = false` (allows anonymous feedback)

**Email Destination:**
The notification will be sent to `hello@draftkit.app` (matching your existing reply-to address). This can be customized if you prefer a different address.

**Security:**
- No authentication required (feedback can be anonymous)
- Email is sent via Resend using your already-configured API key
- Uses the existing `notifications@draftkit.app` sender address

