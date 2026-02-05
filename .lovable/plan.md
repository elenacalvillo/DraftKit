
## What’s actually happening (based on your current logs + code)

The error you’re seeing is **not** “script blocked by an ad blocker” right now.

Your browser console shows:

- **`[Turnstile] Turnstile site key not configured`**

That message is thrown in `TurnstileWidget.tsx` *before* we even try to load Cloudflare’s script. It happens when:

- `import.meta.env.VITE_TURNSTILE_SITE_KEY` is **undefined** in the running frontend build.

At the same time, the backend secrets list confirms the key **does exist**:

- `VITE_TURNSTILE_SITE_KEY` (present)
- `TURNSTILE_SECRET_KEY` (present)

So the issue is: **the frontend build is not receiving the site key at runtime**, even though the project has the secret stored.

This is a common Vite behavior: `import.meta.env.*` values are injected at **build time**, not dynamically. If the platform doesn’t pass that secret into the frontend build environment (or it didn’t rebuild in the right way), the code will always see it as missing.

---

## Goal

Make Turnstile work even if the frontend build doesn’t have `VITE_TURNSTILE_SITE_KEY` injected, and make the UI show the *right* failure reason:

- “Site key missing” (configuration issue) vs
- “Turnstile script blocked” (adblock/network issue) vs
- “Verification failed” (key mismatch, hostname mismatch, etc.)

---

## Proposed solution (robust + future-proof)

### Core change: stop relying on `import.meta.env` for the Turnstile site key
Instead, fetch the **public site key** from the backend at runtime.

This is safe because:
- The **site key is not a secret** (it’s meant to be public)
- Only the secret key must remain private (and it already lives in backend secrets)

---

## Implementation steps (code changes)

### 1) Add a backend function: `turnstile-config` (new)
Create a backend function (edge function) that returns:

- `siteKey` from environment (we will read `VITE_TURNSTILE_SITE_KEY`)
- optionally a `mode` or `env` field for debugging

**Response example**
```json
{ "siteKey": "0x4AAAAAA....", "source": "env" }
```

**Behavior**
- If `VITE_TURNSTILE_SITE_KEY` is missing in the backend env, return `{ siteKey: null }` and log a clear error.
- No secrets (no secret key, no tokens) are ever returned.

Why this fixes your situation:
- The backend environment *does* have that secret (confirmed).
- The frontend can always retrieve it at runtime, even if the Vite build didn’t inject it.

---

### 2) Update `src/components/turnstile/TurnstileWidget.tsx`
Replace the top-level constant:

- Current:
  - `const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;`

- New:
  - Maintain a `siteKey` state inside the component (or a small shared module-level cache)
  - On mount:
    - call `supabase.functions.invoke("turnstile-config")`
    - store `siteKey` in state
    - if missing → set `loadError` to “Security misconfigured (site key missing)”

Also update the UI copy so it’s not generic:
- If `siteKey` missing: show “Security check misconfigured”
- If script blocked/timed out: show “Security check blocked (ad blocker/network)”

This will let you immediately know which category you’re in.

---

### 3) Keep the script loader improvements (already present) and make them reachable
Your script loader is good now (timeout + `onerror`), but currently the widget bails out earlier due to missing site key.

Once we fetch the key at runtime, we’ll actually reach:
- script loading
- render call
- callback token flow

---

### 4) Optional but recommended: remove backend fallback test secret
In `supabase/functions/verify-turnstile/index.ts`, the code currently does:

```ts
const TURNSTILE_SECRET_KEY =
  Deno.env.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA";
```

That fallback can mask config errors and produce confusing results.

Change it to:
- if missing secret key → return `{ success:false, error:"Turnstile secret key not configured" }` (HTTP 500 or HTTP 200 with codes, depending on your preferred pattern)

This makes misconfiguration impossible to miss.

---

## Cloudflare/hostname reality check (what might happen after we fix site key injection)

Once the site key is being used correctly, you may still run into:
- `invalid-input-response`
- hostname mismatch problems (if Cloudflare widget is locked to certain domains)

So in testing we will validate on:
- your custom domain (e.g. `draftkit.app`)
- your published Lovable domain (if used)
- the preview domain (if you want Turnstile to work there too)

If you want Turnstile to work on preview, you must ensure Cloudflare’s allowed hostnames include that preview hostname OR temporarily allow broader hostnames during testing.

---

## Testing checklist (end-to-end)

1) Open `/signup` and confirm the widget no longer immediately says “site key not configured”.
2) Confirm the Turnstile script request loads (no blocking).
3) Submit signup:
   - You should either proceed, or get a meaningful inline message:
     - blocked script vs verification failure vs config issue
4) Repeat in:
   - Incognito
   - Mobile on cellular

---

## Success criteria

- The “Security check unavailable” message disappears for the **site-key-missing** reason.
- If something still fails, the UI now tells us *exactly* whether it’s:
  1) missing site key
  2) blocked Turnstile script
  3) verification/key/hostname mismatch

---

## Files involved

- New: `supabase/functions/turnstile-config/index.ts`
- Update: `src/components/turnstile/TurnstileWidget.tsx`
- Update (recommended): `supabase/functions/verify-turnstile/index.ts`
- (No changes required to Signup/Login pages beyond what you already have, unless we want even more tailored messaging)

