# Fix: Universal Substack URL Parsing + Guest Publish UX

## What's Happening

**Problem 1**: The `fetch-collab-metrics` edge function only understands `username.substack.com/p/slug` URLs. Substack has multiple URL formats that all point to the same post:

- `substack.com/@username/p-192157347` (profile-style)
- `open.substack.com/pub/username/p/slug` (mobile share)
- `substack.app/...` (app deep links)
- `username.substack.com/p/slug` (classic — already works)

When a URL like `substack.com/@codelikeagirl/p-192157347` is stored, `extractSlugFromUrl()` fails (no `/p/` segment), `fetchPostByUrl()` fails (no subdomain), and all metrics come back NULL.

**Problem 2**: When the host marks a collab as published, the status update succeeds, but the background metrics fetch fails and may surface a confusing error toast to the guest. The UI should treat the DB status as the source of truth — if it says `published`, show the success state regardless of metrics fetch outcome.

## Plan

### 1. Universal URL Parser with Follow-Redirect Fallback

In `supabase/functions/fetch-collab-metrics/index.ts`:

**a) Update `isAllowedDomain()**` — Add `substack.app` to allowed domains so app deep-link URLs aren't SSRF-blocked.

**b) Add `resolveCanonicalUrl(url)` function** — The "safety net":

- Takes any Substack URL (profile-style, mobile, app-link)
- Does a `fetch(url, { redirect: "follow" })` with a timeout
- Returns the final canonical URL after redirects (Substack always resolves to `username.substack.com/p/slug`)
- If the redirect lands on an allowed domain and has `/p/` in the path, return it
- If it fails or doesn't resolve cleanly, return `null`

**c) Update `fetchPostByUrl(url)**` — Make it a "catch-all":

- First, try the existing logic (extract subdomain + slug directly)
- If that fails (no subdomain or no slug), call `resolveCanonicalUrl(url)` to follow redirects
- Re-extract subdomain + slug from the resolved canonical URL
- If still no luck, try extracting the username via `extractUsername()` + `resolvePublicationUsername()`, then use the numeric post ID from the URL path (for `p-{id}` format) with Substack's `/api/v1/posts/{id}` endpoint
- All existing `/p/slug` URL handling remains untouched

**d) Update `extractSlugFromUrl(url)**` — Add pattern for `p-{numericId}`:

- Keep existing `/p/([a-zA-Z0-9_-]+)` match
- Add `/p-(\d+)` match for profile-style URLs
- Return the numeric ID as a string (Substack's API accepts both slugs and numeric IDs)

**e) No changes to `extractUsername()**` — it already handles all three formats.

### 2. Guest Publish UX — Status is Source of Truth

CAREFUL HERE THIS IS NOT JUST FOR THE GUEST OR FOR THE HOST, WHETER EACH ONE MARKS THE POST AS PUBLISHED THAT'S IT, NO ONE CAN MARK IT AS PUBLISHED AGAIN BECAUSE THAT IS CREATING AN ERROR FOR THE DATABASE TO TRY TO SUBMIT MORE THAN ONCE.

In `src/pages/Workspace.tsx`, the `handlePublishWithUrls()` function already wraps the metrics fetch in a try/catch (lines 482-488) and the email send in a try/catch (lines 469-479). Both are non-fatal. The success toast fires at line 492 regardless.

The issue is that `supabase.functions.invoke` may throw or return an error object that triggers an unhandled rejection. Fix:

- Ensure the metrics invoke catch block doesn't re-throw
- Add explicit `?.error` check on the invoke response so a 500 from the edge function doesn't bubble up as an uncaught error
- The toast at line 492 ("Congrats on publishing!") already fires in the `finally` — confirm it fires even on metrics failure

### Files Changed


| File                                               | Change                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/functions/fetch-collab-metrics/index.ts` | Add `resolveCanonicalUrl()`, update `isAllowedDomain` for `substack.app`, update `extractSlugFromUrl` for `p-{id}`, update `fetchPostByUrl` with redirect fallback |
| `src/pages/Workspace.tsx`                          | Harden metrics/email invoke calls so errors never surface to the user when the publish status update succeeded                                                     |
