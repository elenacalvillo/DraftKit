
# Final Turnstile Fixes

## Objective
Complete the emergency bypass with three fixes:
1. Backend circuit breaker in the edge function
2. Hide the TurnstileWidget container when bypassed to remove spacing gap
3. Ensure Continue button is always enabled from page load

---

## Implementation Details

### 1. Update verify-turnstile Edge Function (Circuit Breaker)

**File:** `supabase/functions/verify-turnstile/index.ts`

Add logic at the top of the function to check the `TURNSTILE_BYPASS_ENABLED` secret. If it's `true`, immediately return success without calling Cloudflare.

**Changes:**
- Read `TURNSTILE_BYPASS_ENABLED` from environment
- If enabled, log a warning and return `{ success: true, bypassed: true }` immediately
- Skip all Cloudflare verification when bypass is active

```text
Request arrives
      |
      v
Check TURNSTILE_BYPASS_ENABLED env var
      |
      +-- "true" --> console.warn("[verify-turnstile] Security bypassed via Kill Switch")
      |              --> Return { success: true, bypassed: true }
      |
      +-- "false" or missing --> Continue normal verification flow
```

### 2. Fix Spacing: Hide TurnstileWidget When Bypassed

**File:** `src/pages/Signup.tsx` and `src/pages/Login.tsx`

Currently the TurnstileWidget always renders (even with an error message), which creates a 65px gap. When `securityBypassed` is true, we should not render it at all.

**Changes:**
- Wrap the `<TurnstileWidget>` in a conditional: `{!securityBypassed && <TurnstileWidget ... />}`
- This removes the 65px min-height container when bypass is active
- The button snaps up to just below the password field

### 3. Unblock the Button: Always Enabled from Page Load

**Current state:** The button is already only disabled by `isLoading` (line 561 in Signup.tsx, line 238 in Login.tsx shown in provided code). The Turnstile token is NOT blocking the button.

**Verification:** Looking at line 556-561:
```tsx
<Button
  type="submit"
  variant="hero"
  size="lg"
  className="w-full"
  disabled={isLoading}  // Only isLoading controls disabled state
>
```

The button is already fully active and orange when the page loads. No changes needed here, but I'll verify the same pattern exists in Login.tsx.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/verify-turnstile/index.ts` | Add kill switch check at top, return early if `TURNSTILE_BYPASS_ENABLED=true` |
| `src/pages/Signup.tsx` | Wrap TurnstileWidget in `{!securityBypassed && ...}` conditional |
| `src/pages/Login.tsx` | Same conditional rendering for TurnstileWidget |

---

## Edge Function Change Detail

```typescript
// At the top of the handler, before any other logic:
const BYPASS_ENABLED = Deno.env.get("TURNSTILE_BYPASS_ENABLED") === "true";

if (BYPASS_ENABLED) {
  console.warn("[verify-turnstile] Security bypassed via Kill Switch");
  return new Response(
    JSON.stringify({ success: true, bypassed: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Then continue with normal verification...
```

---

## Visual Result After Fix

**Before (current):**
```
[Password field]
[65px gap - "Security check blocked" message]
[Continue button]
```

**After (with bypass active):**
```
[Password field]
[Continue button]  <-- snaps up, no gap
```

---

## Testing Checklist

1. Enable an ad blocker or block Cloudflare domains
2. Visit /signup - the Continue button should be orange and clickable immediately
3. No visible gap between password field and button
4. Submit the form - it should proceed without errors
5. Check console for "Security bypassed" warnings
6. Check edge function logs for "[verify-turnstile] Security bypassed via Kill Switch"
