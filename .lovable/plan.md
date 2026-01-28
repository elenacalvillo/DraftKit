
Goal
- Fix the “View Request” email button so it reliably opens the Requests page (and highlights the specific request) instead of always landing on /dashboard.
- Add a guardrail to prevent accidental duplicate emails during testing / retries.
- Keep all email templates visually consistent with the DraftKit brand.

What’s happening (root cause hypothesis)
- Your app code routes /dashboard/requests correctly (React Router has a dedicated route, and Requests.tsx supports ?highlight=...).
- The behavior you’re describing (“even if I type the URL manually, it becomes /dashboard”) strongly suggests the redirect is happening before the React app can even run (i.e., at the hosting / custom-domain routing layer).
- If the hosting layer rewrites or redirects /dashboard/* → /dashboard, then deep links like /dashboard/requests will never reach the SPA router on initial load, regardless of being logged in.

Strategy (works even if the hosting layer rewrites /dashboard/requests)
1) Make email CTAs link to a “safe” path that we know is not rewritten: /dashboard
2) Encode what we want to open (requests + request id) in the querystring on /dashboard
3) Add a small client-side redirect handler on the Dashboard page that:
   - reads those query params
   - immediately navigates to /dashboard/requests?highlight=...
   - uses replace navigation to avoid back-button weirdness
4) Keep the existing highlight/scroll logic in Requests.tsx (and improve it slightly so the highlighted request is visible even if filters would hide it)

Planned code changes

A) Update ALL email templates’ “View …” links to use a safe deep-link format
File: supabase/functions/send-collab-email/index.ts

- Introduce a single helper for building the CTA link so every template stays consistent:

  Example:
  - const buildDashboardRequestLink = (baseUrl: string, requestId: string) =>
      `${baseUrl}/dashboard?open=requests&highlight=${encodeURIComponent(requestId)}`;

- Replace every occurrence of:
  - ${baseUrl}/dashboard/requests?highlight=${requestId}
  with:
  - ${buildDashboardRequestLink(baseUrl, requestId)}

Why this helps:
- The server only sees /dashboard (a known-good route), so it won’t “collapse” the path.
- The app can then redirect internally to the real /dashboard/requests route and pass highlight along.

B) Add a “Dashboard deep-link router” that forwards /dashboard?open=requests&highlight=... → /dashboard/requests?highlight=...
File: src/pages/Dashboard.tsx

- Import useSearchParams (and optionally useLocation) from react-router-dom.
- Add a useEffect that runs once auth is resolved and the creator exists:
  - If searchParams.get("open") === "requests":
      - Read highlight = searchParams.get("highlight")
      - Navigate to:
        - /dashboard/requests?highlight=<highlight> (if highlight present)
        - /dashboard/requests (if highlight missing)
      - Use navigate(target, { replace: true }) so the URL cleans up and the back button doesn’t bounce oddly.
- Important: run this redirect before fetchData() to reduce flicker (or do it right after auth checks but before heavy UI rendering).

C) Make Requests highlight work even if filters would hide the request
File: src/pages/Requests.tsx

Current behavior:
- highlight only applies after requests are loaded and the request exists in the list.
Potential issue:
- If activeTab is not “all” and the highlighted request is filtered out, the element never exists in DOM, so scroll/highlight won’t occur.

Change:
- When highlightParam exists:
  - temporarily setActiveTab("all") before trying to scroll/highlight
  - then proceed with existing highlight logic

This makes “highlight from email” resilient.

D) Duplicate-email guardrail (optional but recommended before “mass sending”)
Problem:
- Today, if the same send-collab-email call is invoked twice (double-click, retry, client re-submit, network race), Resend can deliver duplicates.

Implementation option (recommended):
1) Add a small database table to log sends (Lovable Cloud migration):
   - public.email_events
     - id uuid primary key default gen_random_uuid()
     - request_id uuid not null
     - type text not null
     - to_email text not null
     - created_at timestamptz not null default now()
     - provider_id text null (Resend message id)
     - status text not null default 'sent' (or 'skipped'/'failed')
2) In send-collab-email:
   - Before sending, check if an identical (request_id, type, to_email) was sent in the last N minutes (e.g., 2–5 minutes).
   - If yes: return 200 with { skipped: true, reason: "DUPLICATE_GUARD" } and do not send.
   - If no: send, then insert an email_events row.

Notes:
- We should NOT dedupe collab_reminder aggressively because reminders may legitimately repeat. We’ll apply the guard only to “event” emails like request_received / approved / declined / cancelled / new_message, or set different windows per type.

Testing / verification checklist (what we’ll do right after implementation)
1) Send a single test email to hello@elenacalvillo.com for a real requestId.
2) Click “View Request”:
   - Expected URL sequence:
     - opens /dashboard?open=requests&highlight=...
     - immediately navigates to /dashboard/requests?highlight=...
3) Confirm Requests page:
   - scrolls to the correct request
   - shows the coral highlight ring
4) Confirm no duplicates:
   - Trigger the same email twice in quick succession (simulated)
   - Expect the second attempt to be skipped (if we implement the guardrail)

Why this plan matches your requirement
- It does not rely on /dashboard/requests being directly reachable on first-load, which appears to be the core problem on your domain right now.
- It still lands users on the correct request, even if they “never logged out,” because it’s independent of session; it’s purely about path handling.
- It keeps your email templates consistent by using a single CTA link helper rather than scattered hard-coded URLs.

Files involved
- supabase/functions/send-collab-email/index.ts (update CTA links; optionally add send logging)
- src/pages/Dashboard.tsx (add query-param deep-link redirect handler)
- src/pages/Requests.tsx (ensure highlight works regardless of tab filters)
- (Optional) Database migration for email_events table (only if we add dedupe/send logging)
