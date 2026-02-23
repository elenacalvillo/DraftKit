## Fix: Unify All Email Headers to DraftKit Branded Wordmark

### The Problem

Some email templates use a random emoji inside a gradient square as their "header icon" instead of the consistent DraftKit two-tone wordmark + tagline. This creates a fragmented, unpolished brand experience.

### Emails That Need Fixing (brand header only -- no content changes)

**In `send-collab-email/index.ts`:**


| Email Type                                     | Current Header                   | Fix                                      |
| ---------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `collab_type_changed` (lines 817-822)          | Gradient box with "pencil" emoji | Replace with DraftKit wordmark + tagline |
| `workspace_updated_by_creator` (lines 876-881) | Gradient box with "pencil" emoji | Replace with DraftKit wordmark + tagline |
| `workspace_updated_by_guest` (lines 920-924)   | Gradient box with "pencil" emoji | Replace with DraftKit wordmark + tagline |


**In `send-feedback-notification/index.ts`:**


| Email Type            | Current Header                 | Fix                                      |
| --------------------- | ------------------------------ | ---------------------------------------- |
| Feedback notification | Colored banner with emoji icon | Replace with DraftKit wordmark + tagline |


### The Standard Header (already used by 10+ other email types)

All headers will be replaced with this exact block:

```html
<div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
  <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">DraftKit</span>
  <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">
    The engine for creators who ship together
  </p>
</div>
```

### Emails Already Correct (no changes needed)

- request_approved, request_declined, request_received, request_submitted
- request_cancelled_by_guest, collab_cancelled_by_host
- new_message, new_message_from_guest
- collab_reminder (host + guest)
- collab_published
- send-collab-retrospective
- send-release-notes

### Technical Details

**File: `supabase/functions/send-collab-email/index.ts**`

For three email types (`collab_type_changed`, `workspace_updated_by_creator`, `workspace_updated_by_guest`), replace the gradient-box emoji header block with the standard DraftKit wordmark header. The heading text (e.g. "Collaboration Type Updated") stays -- only the icon block above it changes.

**File: `supabase/functions/send-feedback-notification/index.ts**`

Replace the colored `<td>` banner header (which has a large emoji + white text label) with the standard DraftKit wordmark header. The email subject line badge (emoji + label) stays in the body content -- only the top-level header block changes to match the brand.

Both edge functions will be redeployed after changes.