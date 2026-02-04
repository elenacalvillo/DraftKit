
# Update Turnstile to Invisible Mode

## Overview

Since you've switched your Cloudflare Turnstile widget to **Invisible** mode in the dashboard, we need to update the code to match. With invisible mode, there's no visible widget - verification happens silently in the background.

## What Changes

| Aspect | Before (Visible) | After (Invisible) |
|--------|------------------|-------------------|
| Widget UI | Shows checkbox or challenge | Nothing visible |
| Token timing | User completes challenge first | Token generated automatically |
| Submit button | Disabled until token exists | Always enabled |
| Verification | Token ready before submit | Token checked on submit |
| UX | User sees security widget | Zero friction |

## Files to Update

### 1. TurnstileWidget.tsx
- Add `'invisible'` as a valid size option
- Change default size from `'flexible'` to `'invisible'`
- Ensure container collapses (no ghost gap) when invisible

### 2. Login.tsx
- Remove the visible widget wrapper `<div className="flex justify-center">`
- Remove the `disabled={!turnstileToken}` requirement from submit button
- Keep verification on submit (backend still validates)

### 3. Signup.tsx
- Same changes as Login - remove visible wrapper, enable submit button

### 4. PublicBooking.tsx
- Same changes - remove visible wrapper, enable submit button

### 5. FeedbackWidget.tsx
- Remove the visible widget wrapper
- Enable submit button (only disable during submission)
- Remove the `size="compact"` prop (invisible doesn't need compact)

## Technical Details

For invisible mode, the Turnstile script:
1. Loads silently in the background
2. Analyzes browser telemetry (mouse, window, headers)
3. Generates a token automatically when it's confident the user is human
4. Passes token to your `onVerify` callback

The form flow becomes:
1. User fills form normally (no widget visible)
2. On submit, check if token exists
3. If no token yet, show a brief "Verifying..." state
4. Once token arrives, verify with backend and proceed

## Safety Note

If Cloudflare can't verify silently (noisy network, VPN), users may see an error. If you get complaints from real users, you can switch to **Managed** mode with `appearance: 'interaction-only'` as a fallback - this only shows the widget when needed.
