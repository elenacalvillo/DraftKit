# Lock the admin area to your account only

## Current state (verified)

- Your account, hello@elenacalvillo.com, is the only account with the admin role in the database.
- The analytics data itself is already admin-only at the database level: reads on the events and feedback tables require the admin role, so a non-admin gets nothing back even if they open the page.
- The analytics page itself checks admin status and bounces non-admins, but the route is only wrapped in the generic signed-in guard. So a signed-in non-admin briefly renders the page shell before the redirect, and any future page added under /admin would have no protection at all by default.

## What changes

1. A single admin-only gate for the whole /admin area. Non-admin visitors never see the page shell: while the check runs they see the loading logo, then they land on a "Page not found" screen rather than a hint that an admin area exists.
2. Anything under /admin is covered by the same gate, including addresses that do not exist yet, so no future admin page can ship unprotected.
3. The analytics page keeps its own check as a second layer.

Nothing about how analytics looks or works changes for you.

## Technical notes

- Add `src/components/auth/AdminRoute.tsx`: reuses `ProtectedRoute` (requireCreator false) plus `useAdmin()`; shows the existing loading screen while `loading`, renders `<NotFound />` when `!isAdmin`, children otherwise.
- In `src/App.tsx`, wrap `/admin/analytics` in `AdminRoute` and add a catch-all `/admin/*` route inside the same gate rendering `NotFound`.
- Leave the in-page `useAdmin` guard in `AdminAnalytics.tsx` in place as defence in depth.
- No schema, RLS, or policy changes: the admin-role RLS on `analytics_events` and `user_feedback` already enforces server-side access.
