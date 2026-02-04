
# Cloudflare Turnstile Anti-Bot Protection

## Status: ✅ IMPLEMENTED (using test keys)

## Overview

Add invisible/managed Cloudflare Turnstile protection to public-facing forms to prevent automated abuse while maintaining a seamless user experience. Turnstile is privacy-focused and less intrusive than reCAPTCHA.

## Protected Surfaces

| Surface | File | Risk Level |
|---------|------|------------|
| Public Booking Form | `src/pages/PublicBooking.tsx` | High - unauthenticated, creates DB records + triggers emails |
| Signup Flow (Step 1) | `src/pages/Signup.tsx` | High - account creation vector |
| Feedback Widget | `src/components/feedback/FeedbackWidget.tsx` | Medium - unauthenticated writes |
| Login Form | `src/pages/Login.tsx` | Medium - brute force protection |

## Architecture

```text
+------------------+     +------------------+     +-------------------+
|   Frontend Form  | --> |  Edge Function   | --> |  Cloudflare API   |
|   (Turnstile     |     |  (verify-        |     |  /siteverify      |
|    Widget)       |     |   turnstile)     |     |                   |
+------------------+     +------------------+     +-------------------+
        |                        |
        |                        v
        |               +------------------+
        +-------------> |  Original Action |
           on success   |  (insert to DB,  |
                        |   send email)    |
                        +------------------+
```

## Implementation Steps

### Step 1: Add Turnstile Secret Key

Store the Turnstile secret key as a backend secret:
- **Secret Name**: `TURNSTILE_SECRET_KEY`
- This will be used by the edge function to verify tokens server-side

### Step 2: Create Verification Edge Function

Create `supabase/functions/verify-turnstile/index.ts`:
- Accepts a Turnstile token from the frontend
- Validates the token against Cloudflare's `/siteverify` endpoint
- Returns success/failure response
- Includes CORS headers for browser access

### Step 3: Create React Turnstile Component

Create `src/components/turnstile/TurnstileWidget.tsx`:
- Wraps the Cloudflare Turnstile script
- Manages widget lifecycle (load, render, reset)
- Exposes token via callback
- Handles error and expiry states
- Supports invisible/managed widget modes

### Step 4: Update Public Booking Form

Modify `src/pages/PublicBooking.tsx`:
- Import and render TurnstileWidget
- Capture token in state before form submission
- Call `verify-turnstile` edge function before inserting to database
- Block submission if verification fails
- Reset widget on error for retry

### Step 5: Update Signup Flow

Modify `src/pages/Signup.tsx`:
- Add TurnstileWidget to Step 1 (account creation)
- Verify token before calling `signUp`
- Handle verification failures gracefully

### Step 6: Update Feedback Widget

Modify `src/components/feedback/FeedbackWidget.tsx`:
- Add TurnstileWidget inside the modal
- Verify before inserting to `user_feedback`
- Reset on modal close/reopen

### Step 7: Update Login Form

Modify `src/pages/Login.tsx`:
- Add TurnstileWidget
- Verify before calling `signIn`
- Helps prevent credential stuffing attacks

### Step 8: Add Turnstile Site Key to Environment

Add the public site key to the `.env` file:
- **Variable**: `VITE_TURNSTILE_SITE_KEY`
- This is a publishable key (safe to include in frontend code)

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/verify-turnstile/index.ts` | Server-side token verification |
| `src/components/turnstile/TurnstileWidget.tsx` | Reusable Turnstile React component |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add verify-turnstile function config |
| `src/pages/PublicBooking.tsx` | Integrate Turnstile widget + verification |
| `src/pages/Signup.tsx` | Integrate Turnstile widget on Step 1 |
| `src/pages/Login.tsx` | Integrate Turnstile widget |
| `src/components/feedback/FeedbackWidget.tsx` | Integrate Turnstile widget |

## Technical Details

### Turnstile Widget Component

```tsx
// Props interface
interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
}
```

### Edge Function Verification

The `verify-turnstile` function will:
1. Extract the token from the request body
2. Call Cloudflare's siteverify endpoint with the secret key
3. Return `{ success: true }` or `{ success: false, error: "reason" }`
4. Include rate limiting (100 requests/hour per IP) to prevent abuse

### Form Integration Pattern

Each form will follow this pattern:
1. Render TurnstileWidget, storing token in state
2. On submit, check if token exists
3. Call `verify-turnstile` edge function
4. If success, proceed with original action
5. If failure, show error and reset widget

## Secret Required

You'll need to create a Cloudflare Turnstile widget in your Cloudflare dashboard:

1. Go to https://dash.cloudflare.com/ → Turnstile
2. Click "Add site"
3. Enter your domain: `draftkit.app` (and `lovable.app` for preview)
4. Choose widget mode: **Managed** (recommended) or **Invisible**
5. Copy the **Site Key** (for frontend) and **Secret Key** (for backend)

## Graceful Degradation

If Turnstile fails to load (network issues, blocked scripts):
- Forms will still be submittable after a timeout
- Server-side rate limiting remains as backup protection
- Analytics will track Turnstile failures for monitoring
