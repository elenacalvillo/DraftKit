

# Fix Turnstile Layout Gap

## Problem
When Turnstile fails, there's still a 65px gap between the password field and the Continue button. This happens because:
1. The TurnstileWidget renders with `min-h-[65px]` in all states (loading, error, success)
2. When an error occurs, the widget calls `onBypass` but still renders the error message div
3. The parent's `securityBypassed` state updates, but there's a brief moment where the error div is visible

## Solution
Update TurnstileWidget to return `null` (render nothing) when it has an error, instead of showing the error message. The bypass logic already works - we just need to hide the visual element.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/turnstile/TurnstileWidget.tsx` | Return `null` instead of error div when `errorType` is set |

---

## Implementation Detail

**Current code (line 302-316):**
```tsx
// Show specific error states
if (errorType) {
  const errorMessages = { ... };
  
  return (
    <div className="min-h-[65px] flex items-center justify-center ...">
      <span className="text-destructive">{errorMessages[errorType]}</span>
    </div>
  );
}
```

**New code:**
```tsx
// When error occurs, render nothing - bypass is active
if (errorType) {
  return null;
}
```

This removes the 65px container entirely when the security check fails. Combined with the existing `{!securityBypassed && <TurnstileWidget />}` in Signup/Login, this ensures:
- No error message shown (since bypass is handling it)
- No min-height container taking up space
- Standard `space-y-6` gap flows naturally between password and button

---

## Visual Result

**Before:**
```
[Password field]
[65px gap with "Security check blocked" message]
[Continue button]
```

**After:**
```
[Password field]
[Continue button]  <-- standard space-y-6 gap only
```

---

## Why This Works

The flow is:
1. TurnstileWidget mounts, shows "Loading security check..." (65px)
2. Error occurs → `onBypass("reason")` is called → parent sets `securityBypassed = true`
3. **Immediately**: Widget returns `null` (no error div rendered)
4. **Next render**: Parent's conditional `{!securityBypassed && ...}` removes the widget entirely

Both paths lead to the widget being removed from DOM with no gap.

