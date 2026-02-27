
Goal: stop booking failures immediately for registered emails while keeping Account Blindness.

Implementation steps:
1) Update backend trigger function `public.link_request_to_existing_user` to a no-op for booking inserts (always `RETURN NEW` without assigning `requester_user_id`).
2) Keep trigger `trg_link_request_to_existing_user` attached (safe), but with no-op behavior to avoid future migration dependencies.
3) Add a migration that:
   - `CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()` with no linking logic.
   - Adds a comment documenting that reconciliation is handled by `link_requests_to_new_user` only.
4) Keep frontend insert as-is (`requester_user_id: null`) in `src/pages/PublicBooking.tsx`.
5) Improve observability in `src/pages/PublicBooking.tsx` error block:
   - Log `error.code`, `error.message`, `error.details`, `error.hint`, and payload summary (excluding sensitive message body).
6) Validate in test environment:
   - Case A: logged-in user submits with `elenacalvilloalcalde@gmail.com` (registered, different account) → must insert successfully.
   - Case B: anonymous user submits same email → must insert successfully.
   - Case C: invalid profile URL (`substack.com/@...`) still fails with URL validation trigger.
7) Confirm rows inserted by querying latest `collab_requests` for that email and checking `requester_user_id IS NULL`.
8) Publish once test passes so live matches preview behavior.

Technical details:
- Root cause confirmed: trigger-level identity matching still runs for authenticated sessions and sets `NEW.requester_user_id` to the matched account (`ce0504e4-...`) while caller auth user is different (`e12cb16e-...`), violating `collab_requests` INSERT RLS check.
- This is why failures happen specifically with already-registered emails, even after frontend Account Blindness changes.
- RLS policy itself is structurally correct for Account Blindness; trigger mutation is the conflicting layer.
