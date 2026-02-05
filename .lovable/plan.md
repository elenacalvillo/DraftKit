
# Emergency Turnstile Bypass (Circuit Breaker)

## Objective
Enable the "Continue" button on Signup and Login even when Turnstile fails, so your 119 visitors can sign up immediately. Log bypassed events for tracking.

---

## Implementation Summary

### 1. Add Kill Switch Secret
Create a new backend secret `TURNSTILE_BYPASS_ENABLED` (value: `true` or `false`). When `true`, the bypass logic is active. When you want to enforce security later, set it to `false` without any code changes.

### 2. Update TurnstileWidget.tsx
Add a new prop `onBypass` that fires when the widget encounters any error (load failure, script blocked, config fetch error, etc.). This callback will pass a reason string for logging.

Current behavior: Shows error message and blocks submission
New behavior: Shows error message AND calls `onBypass("reason")` so parent can enable submission

### 3. Update Signup.tsx
- Add `securityBypassed` state (boolean)
- When `handleTurnstileError` fires, set `securityBypassed = true` and log: `console.warn('Security bypassed due to load failure')`
- In `handleStep1` submit handler:
  - If `securityBypassed === true`, skip the token polling and verification entirely
  - Log: `console.warn('Signup proceeding without security check')`
  - Proceed directly to `signUp()`
- Keep "Continue" button enabled (remove the check for turnstile token in disabled state)

### 4. Update Login.tsx
Same pattern:
- Add `securityBypassed` state
- When `handleTurnstileError` fires, set `securityBypassed = true` and log bypass
- In `handleSubmit`:
  - If `securityBypassed === true`, skip token check and verification
  - Log warning and proceed to `signIn()`
- Keep "Sign In" button enabled

### 5. Update verify-turnstile Edge Function (Optional Enhancement)
Add logic to read `TURNSTILE_BYPASS_ENABLED`. If bypass is enabled and token is missing/invalid, return `{ success: true, bypassed: true }` instead of failing. This is a belt-and-suspenders approach in case the frontend check is somehow circumvented.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/turnstile/TurnstileWidget.tsx` | Add `onBypass` prop that fires on any error with reason |
| `src/pages/Signup.tsx` | Add `securityBypassed` state, skip verification when true, log warnings |
| `src/pages/Login.tsx` | Same bypass logic as Signup |
| `supabase/functions/verify-turnstile/index.ts` | Optional: respect `TURNSTILE_BYPASS_ENABLED` flag |

---

## How It Works

```text
User visits /signup
       |
       v
TurnstileWidget mounts
       |
       +-- Fetch siteKey from backend
       |       |
       |       +-- Fails? --> onBypass("fetch_error") --> securityBypassed = true
       |       |              console.warn('Security bypassed due to load failure')
       |       v
       +-- Load Cloudflare script
       |       |
       |       +-- Blocked/Timeout? --> onBypass("script_blocked") 
       |       |                        --> securityBypassed = true
       |       v
       +-- Render widget
               |
               +-- Error callback? --> onBypass("widget_error")
                                       --> securityBypassed = true

User clicks "Continue"
       |
       v
Check securityBypassed?
       |
       +-- true --> console.warn('Signup proceeding without security check')
       |            --> Skip token verification
       |            --> Call signUp() directly
       |
       +-- false --> Normal flow (wait for token, verify, then signUp)
```

---

## Kill Switch Usage

To disable bypass later:
1. Go to your backend secrets
2. Set `TURNSTILE_BYPASS_ENABLED` to `false`
3. No code deploy needed - the backend will enforce verification again

To re-enable bypass during another outage:
1. Set `TURNSTILE_BYPASS_ENABLED` to `true`

Note: The frontend bypass is always active when the widget fails. The kill switch controls whether the backend also accepts requests without valid tokens.

---

## Console Logging

When bypass is triggered, you'll see:
- `console.warn('Security bypassed due to load failure')` - when widget fails to load
- `console.warn('Signup proceeding without security check')` - when form is submitted with bypass active
- `console.warn('Login proceeding without security check')` - same for login

This lets you track bypass events in any log aggregator.

---

## Security Note

This bypass is a calculated tradeoff: you're accepting slightly higher bot risk in exchange for not blocking real users. With the kill switch, you can re-enable strict security once Cloudflare/DNS stabilizes.
