
## Fix: Remove Email Exposure from Send Message Modal

The email address is leaking in two places inside `SendMessageModal.tsx`:

1. **Dialog description**: "Send a quick message to your collaborator at anna@bubblebossco.com"
2. **Success toast**: "They'll receive it at anna@bubblebossco.com"

Both will be updated to remove the raw email, keeping the privacy-first masking pattern consistent with the rest of the app.

### Changes

**File: `src/components/requests/SendMessageModal.tsx`**

| Location | Current | Updated |
|----------|---------|---------|
| Line 89 (DialogDescription) | `Send a quick message to your collaborator at {requesterEmail}` | `Send a quick message to your collaboration partner` |
| Line 66-68 (toast) | `description: "They'll receive it at " + requesterEmail` | Remove the `description` line entirely -- the toast will just say "Message sent to Anna Levitt!" |

No other files need changes. The sidebar in Workspace.tsx already uses the masked "Send Email" label pattern.
