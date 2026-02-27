

## Fix: "Protocol Wall" on Substack Profile Input

Karen's bug is straightforward. The Signup form uses `type="url"` on the Substack Profile input, which triggers native browser validation requiring `https://`. Users naturally type `substack.com/@name` as the placeholder suggests, and the browser blocks them before your code even runs.

Your existing `normalizeSubstackUrl()` utility already handles all formats (bare usernames, profile URLs, mobile share links) perfectly. The browser is just blocking users from reaching it.

### Changes

**1. `src/pages/Signup.tsx`** — Change `type="url"` to `type="text"` on the Substack Profile input (line 724). The Zod schema + `normalizeSubstackUrl` already validate properly.

**2. `src/pages/Settings.tsx`** — Confirm input is already `type="text"` (it is). No change needed.

**3. Both files** — Update placeholder from `substack.com/@yourname` to `yourname.substack.com or substack.com/@yourname` so users see both accepted formats clearly.

One line change + two placeholder updates. No architectural changes needed.

