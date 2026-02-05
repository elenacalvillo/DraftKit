

# Fix Turnstile Re-rendering and Verification Issues

## Root Cause Analysis

### Issue 1: Form "Jumping" on Every Keystroke
The `TurnstileWidget` component re-renders and re-initializes on every keystroke because:
- `onVerify={setTurnstileToken}` creates a new function reference on each parent render
- The widget's `useEffect` depends on `handleVerify`, which changes when `onVerify` changes
- This causes the widget to be destroyed and recreated, causing the visual "jump"

### Issue 2: "Security verification failed" Error
The constant re-rendering invalidates the Turnstile token:
- Each time the widget re-renders, the old token is discarded
- By the time the user submits, the token stored in state may be stale or from a reset widget
- The backend verification fails because the token doesn't match

### Issue 3: Widget Showing as Visible (Test Mode Badge)
The screenshot shows "Testing only, always passes" - this indicates the test key is being used. Test keys always show visible UI. The production key should make it invisible.

## Solution

### 1. Memoize the TurnstileWidget Component
Wrap the component with `React.memo` to prevent re-renders when props haven't changed:

```typescript
export const TurnstileWidget = React.memo(function TurnstileWidget({...}) {
  // existing implementation
});
```

### 2. Stabilize Callback References
Use `useRef` to store the callbacks and access them via refs inside the effect:

```typescript
const onVerifyRef = useRef(onVerify);
const onErrorRef = useRef(onError);
const onExpireRef = useRef(onExpire);

// Update refs when props change (no effect re-run)
useEffect(() => {
  onVerifyRef.current = onVerify;
  onErrorRef.current = onError;
  onExpireRef.current = onExpire;
});

// Use stable callbacks
const handleVerify = useCallback((token: string) => {
  onVerifyRef.current(token);
}, []); // Empty deps - never changes
```

### 3. Remove Callbacks from useEffect Dependencies
With stable refs, the effect only runs once on mount:

```typescript
useEffect(() => {
  // initialization code
}, [theme, size, appearance]); // Only re-run on config changes
```

### 4. Fix Token Capture with useRef in Forms
Use a ref alongside state to ensure the token is always captured correctly at submission time (same pattern as FeedbackWidget):

| File | Change |
|------|--------|
| `Login.tsx` | Add `turnstileTokenRef` to capture token reliably |
| `Signup.tsx` | Add `turnstileTokenRef` to capture token reliably |
| `PublicBooking.tsx` | Add `turnstileTokenRef` to capture token reliably |

## Files to Modify

### TurnstileWidget.tsx
- Add `React.memo` wrapper
- Use refs for callback props to prevent effect re-runs
- Stabilize `handleVerify`, `handleError`, `handleExpire` with empty dependency arrays

### Login.tsx
- Add `turnstileTokenRef` alongside `turnstileToken` state
- Update submit handler to read from ref
- Add "Verifying..." state for edge case (matches FeedbackWidget pattern)

### Signup.tsx
- Same changes as Login.tsx

### PublicBooking.tsx
- Same changes as Login.tsx

## Technical Details

The fix uses a common React pattern for stable callbacks:

```text
+------------------+      +------------------+
|   Parent Form    |      |  TurnstileWidget |
+------------------+      +------------------+
|                  |      |                  |
| formData state   |      | onVerifyRef      |
| changes on type  |----->| (stable ref)     |
|                  |      |                  |
| onVerify prop    |      | useEffect only   |
| (new reference)  |      | runs on mount    |
|                  |      |                  |
+------------------+      +------------------+
```

With refs:
- Parent re-renders on keystroke (normal)
- TurnstileWidget receives new `onVerify` prop reference
- But the ref is updated without triggering the effect
- Widget stays mounted, no visual jump
- Token remains valid

## Expected Outcome
- No more form "jumping" on keystrokes
- Token captured reliably at submission time
- "Security verification failed" errors eliminated
- Invisible mode works correctly with production keys

