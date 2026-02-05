

# Runtime Turnstile Site Key Fetching

## Problem

The `VITE_TURNSTILE_SITE_KEY` environment variable exists in backend secrets but is not being injected into the frontend build. Vite injects `import.meta.env.*` values at **build time**, so if the build didn't have access to the secret, it will always be `undefined` at runtime.

This causes the immediate "Security check unavailable" error for all users visiting signup/login.

---

## Solution

Fetch the Turnstile site key from the backend at runtime instead of relying on build-time injection. This is safe because the site key is **public** (it's designed to be embedded in client-side code).

---

## Implementation

### Step 1: Create new edge function `turnstile-config`

**File:** `supabase/functions/turnstile-config/index.ts`

This function returns the public site key to the frontend:

```text
Request:  GET or POST (no body needed)
Response: { "siteKey": "0x4AAAAAA...", "source": "env" }
          or { "siteKey": null, "error": "..." } if not configured
```

The function reads `VITE_TURNSTILE_SITE_KEY` from backend environment and returns it. No secrets are exposed.

### Step 2: Update config.toml

Add the new function configuration:

```toml
[functions.turnstile-config]
verify_jwt = false
```

### Step 3: Update TurnstileWidget.tsx

Replace the static `import.meta.env` read with a runtime fetch:

| Current | New |
|---------|-----|
| `const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;` | Fetch from `turnstile-config` on mount, store in state |

Changes:
- Add `siteKey` state (starts as `null`)
- Add `isLoading` state to show loading indicator
- On mount: call `supabase.functions.invoke("turnstile-config")`
- If `siteKey` is returned: proceed to load Turnstile script
- If missing: show "Security misconfigured" error
- If script blocked: show "Security blocked (ad blocker)" error

### Step 4: Improve verify-turnstile robustness

Remove the fallback test secret key so configuration errors are caught:

```text
Current:  const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY') || '1x000...AA';
New:      const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY');
          if (!TURNSTILE_SECRET_KEY) return error response
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/turnstile-config/index.ts` | Create new |
| `supabase/config.toml` | Add function config |
| `src/components/turnstile/TurnstileWidget.tsx` | Fetch site key at runtime |
| `supabase/functions/verify-turnstile/index.ts` | Remove fallback secret |

---

## Error State Improvements

After this change, users will see specific error messages:

| Condition | Message |
|-----------|---------|
| Site key not configured in backend | "Security check misconfigured" |
| Turnstile script blocked by ad blocker | "Security check blocked (ad blocker/network)" |
| Script load timeout | "Security check timed out" |
| Verification failed (key mismatch) | Specific error from backend |

---

## Technical Details

### turnstile-config edge function

```typescript
// Reads VITE_TURNSTILE_SITE_KEY from Deno.env
// Returns { siteKey: string | null }
// CORS enabled, no JWT required
```

### TurnstileWidget state flow

```text
Mount
  |
  v
Fetch turnstile-config
  |
  +-- Error? --> Show "Security misconfigured"
  |
  v
Got siteKey
  |
  v
Load Turnstile script
  |
  +-- Blocked/Timeout? --> Show "Security blocked"
  |
  v
Render widget with siteKey
  |
  v
User interaction --> Token callback
```

---

## Expected Outcome

- The "Security check unavailable" error disappears for users
- Turnstile widget loads and renders correctly
- If there's still a configuration issue (wrong keys), the error messages will be specific and actionable
- No more reliance on build-time environment variable injection

