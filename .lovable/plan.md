
Goal: make signup/login reliably pass the Turnstile security check (no “timed out” loops), and make any remaining failures clearly actionable. Right now we have two distinct failure modes:
1) Token never arrives within 10s (frontend never receives `callback(token)`), so users hit the “Security check took too long…” UX.
2) Backend verification fails with `invalid-input-response` (seen in backend logs), which strongly suggests a configuration mismatch (site key vs secret key, or domain/hostname mismatch).

What I found in your project
- The frontend site key is read from `import.meta.env.VITE_TURNSTILE_SITE_KEY` but still has a fallback to Cloudflare’s public test key:
  - `const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';`
  If the env var is missing or not injected at build time, the app silently uses the test key, which can cause “production key mismatch” symptoms.
- Your backend verification function currently returns HTTP 400 on verification failure. With `supabase.functions.invoke(...)`, non-2xx responses become a client “error” and the client does not reliably receive the JSON body (including error codes). That makes UX/debugging much harder.
- Console warning in the user session: “Function components cannot be given refs … Check the render method of Signup … at TurnstileWidget”. Even though Signup doesn’t pass a `ref` explicitly, it’s happening at runtime, so we should make TurnstileWidget ref-safe via `forwardRef` to eliminate this warning and any side effects.
- Secrets are present in the backend environment:
  - `VITE_TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET_KEY`
  Presence doesn’t guarantee correctness (they must be a matching pair from the same Turnstile widget configuration in Cloudflare, and the widget must allow the domain(s) you’re testing on).

Plan (implementation)
A) Make TurnstileWidget fail fast when the script can’t load or the widget can’t initialize
1) Update `src/components/turnstile/TurnstileWidget.tsx` script loader robustness:
   - Add `script.onerror` handler to resolve a “load failed” state instead of leaving the Promise pending forever.
   - Add a script-load timeout (e.g., 8s) so we can show a clear “Security couldn’t load (blocked?)” message rather than waiting for token polling to time out.
   - Add a stable “loaded/failed” state to prevent repeated attempts spamming.
   - Add `render=explicit` to the script URL to align with explicit `window.turnstile.render(...)` usage:
     - `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad`
2) Remove the risky production fallback to the universal test site key:
   - Keep the test fallback only in local dev if needed; otherwise, if `VITE_TURNSTILE_SITE_KEY` is missing, immediately call `onError` and render an inline placeholder that says security is misconfigured.
   - This prevents silently shipping a test key to real users.
3) Convert TurnstileWidget export to be `forwardRef` compatible to eliminate the runtime ref warning:
   - Wrap the memoized component with `React.forwardRef<HTMLDivElement, TurnstileWidgetProps>` and merge the forwarded ref with `containerRef`.
   - This removes the “cannot be given refs” warning and protects us if any library is attaching refs implicitly.

B) Improve user-visible error UX by differentiating “can’t load security” vs “still verifying” vs “verification failed”
1) Update all protected forms to respond to TurnstileWidget errors immediately (not only at submit-time):
   - Signup: `src/pages/Signup.tsx`
   - Login: `src/pages/Login.tsx`
   - Public booking: `src/pages/PublicBooking.tsx`
   - Feedback: `src/components/feedback/FeedbackWidget.tsx`
   Changes:
   - Replace `onError={handleTurnstileExpireOrError}` with a dedicated handler that:
     - Clears token
     - Sets `securityError` immediately (inline + toast)
     - Message example: “Security check couldn’t load. If you use an ad blocker / strict privacy mode, try disabling it or use another browser.”
   This prevents the current pattern where Turnstile fails silently, and the user only sees a confusing timeout after clicking submit.
2) Keep the 10s polling (already implemented) and keep the “Verifying security…” button text (already implemented) — but ensure it triggers in every form consistently:
   - Confirm PublicBooking submit button is disabled on `isVerifying` and shows “Verifying security…”
   - Confirm FeedbackWidget uses “Verifying security…” wording (currently “Verifying...”; we’ll standardize copy across the app)

C) Return diagnostic information from backend verification (without exposing secrets) and stop hiding important error codes
1) Update `supabase/functions/verify-turnstile/index.ts` response behavior:
   - For verification failures (Turnstile responds `success: false`), return HTTP 200 with `{ success: false, codes: [...], error: '...' }`
     - This ensures the client receives `codes` via `data` rather than getting a generic invoke error from a 400 status.
   - Keep HTTP 500 only for genuine server errors (exceptions / invalid JSON).
2) Update `src/lib/turnstile.ts` to surface error codes to callers:
   - Expand `TurnstileVerifyResult` to include `codes?: string[]`
   - If the backend returns `success: false`, pass through `codes` to the UI.
3) Use `codes` to improve UX and debugging:
   - If codes include something like `invalid-input-response` repeatedly, show an inline message that indicates a configuration issue (site key/secret key mismatch or hostname mismatch) and instruct the user to refresh and try again; if it persists, we’ll show a short “We’re fixing this security setup” message rather than blaming the user’s VPN/adblocker.
   - Still keep the existing “VPN/adblocker” hint for true timeouts / script load failures.

D) Cloudflare configuration checklist (required to actually stop the mismatch)
This is the part I cannot “fix in code” if the Cloudflare widget configuration is wrong, but we’ll make it obvious when it’s wrong.
1) Ensure the Site Key and Secret Key come from the same Turnstile widget configuration in Cloudflare (both “production” keys).
2) Ensure the widget’s allowed hostnames include every domain users will use:
   - Your custom domain (the screenshot shows `draftkit.app`)
   - Your published domain (if different)
   - Your preview/testing domain (if you test there)
   If hostnames are restricted and don’t include the active domain, you’ll see failures like invalid responses or challenges that never complete.
3) After changing keys/secrets, ensure the app gets rebuilt so the frontend receives the updated `VITE_TURNSTILE_SITE_KEY` (Vite variables are injected at build time). As part of this implementation we’ll also add a dev-only console line to print a short sitekey prefix + current hostname to make it easy to confirm the correct key is in use.

Acceptance criteria (how we’ll know it’s fixed)
1) On /signup, typical users can click “Continue” and see “Verifying security…” briefly (or not at all) and proceed to Step 2 without the timeout toast.
2) If Turnstile is blocked (ad blocker), the user sees an immediate inline error (“Security couldn’t load…”) without waiting 10 seconds.
3) If keys/hostnames are misconfigured, the UI shows a clear configuration-style failure (and logs carry the Cloudflare error codes) instead of a vague timeout.
4) Backend logs no longer show repeated `invalid-input-response` for normal users signing up.

Files that will be modified (no new dependencies)
- `src/components/turnstile/TurnstileWidget.tsx` (script load failure handling, remove risky fallback, forwardRef, render=explicit)
- `supabase/functions/verify-turnstile/index.ts` (return 200 on verify failures + include codes consistently)
- `src/lib/turnstile.ts` (return codes to UI)
- `src/pages/Signup.tsx` (immediate onError UX + consistent copy)
- `src/pages/Login.tsx` (same)
- `src/pages/PublicBooking.tsx` (same)
- `src/components/feedback/FeedbackWidget.tsx` (same + copy consistency)

Potential risks / tradeoffs
- Returning 200 on verification failures is intentional to improve client handling and UX; we’ll still treat `success:false` as a failure everywhere.
- Removing the production fallback to the test site key may cause security to “fail fast” if the site key isn’t configured; that’s desired because silent fallback is worse and creates the key mismatch loop you’re seeing.

Next step after approval
- Implement the changes above, then test signup end-to-end on the same domain shown in your screenshot (draftkit.app) to confirm the Cloudflare hostname allowlist matches where users actually sign up.
