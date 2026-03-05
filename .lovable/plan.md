

## Problem

1. **Timo IS receiving the approval email** — the `request_approved` flow in `Requests.tsx` (line 181) fires correctly and the edge function handles it.
2. **But the CTA is wrong** — the approval email's call-to-action is a `mailto:` link ("Reply to [creator]"), which sends Timo to his email client instead of into the DraftKit workspace where drafting actually happens.
3. This directly undermines the platform retention strategy: the workspace is where value is captured, not email threads.

## Solution: Replace the mailto CTA with a "Open Workspace" link

In `supabase/functions/send-collab-email/index.ts`, update the `request_approved` email template (lines 337-343):

**Before:**
```html
<a href="mailto:${creatorEmail}?subject=Re: Collaboration on ${formattedDate}" ...>
  Reply to ${creatorName}
</a>
```

**After:**
```html
<a href="https://collabstack.lovable.app/dashboard/my-requests" ...>
  Open Your Workspace →
</a>
```

The link points to `/dashboard/my-requests` — the requester's view where they can see approved requests and click "Start Drafting" to enter the workspace. We use this route instead of a direct `/dashboard/workspace/${requestId}` because the requester may not be signed up yet (Account Blindness pattern), and `/my-requests` handles that gracefully after login.

Additionally, add a secondary line below the button: a subtle text note like "Sign up or log in to start drafting with [creator]" to guide new users.

### Files changed
- `supabase/functions/send-collab-email/index.ts` — update the CTA block in the `request_approved` template (lines 337-343)

### Verification
After deploying, ask Timo to check if the existing email arrived (it should have). The next approval will include the new workspace CTA.

