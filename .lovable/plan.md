

# Fix Turnstile Verification: 10s Timeout + Better UX + Managed Mode

## Summary

Users are seeing "Security verification timed out" errors because:
1. The 3-second timeout is too short for slower networks/VPNs
2. The button shows a generic spinner instead of clear "Verifying security..." text
3. The `appearance` setting is not aligned with Cloudflare Managed mode
4. Error messages are unclear about what went wrong

This plan updates **all protected forms** (Login, Signup, Public Booking, Feedback) with consistent improvements.

---

## What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Token wait timeout | 3 seconds | **10 seconds** |
| Widget size | `invisible` | **`flexible`** (visible fallback when needed) |
| Widget appearance | `always` | **`interaction-only`** (shows only if challenge needed) |
| Button text during wait | Spinner only | **"Verifying security..."** with spinner |
| Error handling | Toast only | **Inline message + toast** |
| Error message | Generic "timed out" | Actionable hints (VPN, adblocker) |

---

## Files to Modify

### 1. TurnstileWidget.tsx
- Change default `appearance` from `'always'` to `'interaction-only'`
- Change default `size` from `'invisible'` to `'flexible'`
- Add a minimum-height container style to prevent layout shift when widget appears

### 2. Login.tsx
- Increase `maxWait` from 3000ms to 10000ms
- Update button text to show "Verifying security..." during wait
- Add inline error state for security failures (in addition to toast)
- Improve error messages with actionable hints

### 3. Signup.tsx
- Same changes as Login.tsx

### 4. PublicBooking.tsx
- Same changes as Login.tsx
- Also fix the submit button to check `isVerifying` state (currently only checks `isSubmitting`)

### 5. FeedbackWidget.tsx
- Update timeout from 30 attempts (3s) to 100 attempts (10s)
- Already has "Verifying..." text (keep it)
- Add inline error support

---

## Technical Implementation Details

### Timeout Increase

```typescript
// Before (3 seconds)
const maxWait = 3000;

// After (10 seconds)
const maxWait = 10000;
```

### Button with "Verifying security..." Text

```typescript
<Button disabled={isLoading || isVerifying}>
  {isVerifying ? (
    <>
      <Spinner className="mr-2" />
      Verifying security...
    </>
  ) : isLoading ? (
    <Spinner />
  ) : (
    "Sign In"
  )}
</Button>
```

### TurnstileWidget Default Props

```typescript
// Before
size = 'invisible',
appearance = 'always',

// After
size = 'flexible',
appearance = 'interaction-only',
```

### Inline Error State

Add a new state variable `securityError` to show a styled inline message near the submit button when verification fails:

```typescript
{securityError && (
  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    {securityError}
  </div>
)}
```

### Improved Error Messages

| Scenario | Current Message | Improved Message |
|----------|-----------------|------------------|
| Timeout | "Security verification timed out. Please try again." | "Security check took too long. If you're using a VPN or ad blocker, try disabling it temporarily." |
| Failed | "Security verification failed. Please try again." | "Security check failed. Please refresh the page and try again. If the issue persists, try a different browser." |

---

## Flow Diagram

```text
User clicks Submit
       |
       v
  Token ready?
  /          \
Yes            No
 |              |
 v              v
Verify      Set isVerifying = true
token       Show "Verifying security..."
 |              |
 |              v
 |          Poll every 100ms
 |          (up to 10 seconds)
 |              |
 |         Token arrived?
 |         /          \
 |       Yes           No (timeout)
 |        |              |
 |        v              v
 |    Continue      Show inline error
 |    verification  + toast with hints
 |        |
 v        v
Verify token with backend
       |
  Success?
  /      \
Yes       No
 |         |
 v         v
Proceed   Show inline error
          + toast with hints
```

---

## Expected Outcome

After these changes:
- Users on slower networks have 10 seconds instead of 3 seconds
- The button clearly shows "Verifying security..." so users know the app is working
- The widget will show a visible challenge only if Cloudflare needs human interaction
- Errors include actionable suggestions (disable VPN, try different browser)
- Error messages appear both inline and as a toast for maximum visibility

