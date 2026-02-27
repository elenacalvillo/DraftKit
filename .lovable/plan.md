
Root cause to fix now:
- The insert call still uses `.select('id').single()` on `collab_requests`.
- That forces a read (`RETURNING`) of the new row, and your current `SELECT` RLS blocks reading guest rows (`requester_user_id = null`), so the request fails with 401/42501 even when write payload is valid.

Implementation steps (hotfix-first):
1) Update `src/pages/PublicBooking.tsx` submit path to stop requesting row data:
   - Replace `insert(...).select('id').single()` with plain `insert(...)` (no `select`, no `single`).
   - Keep `requester_user_id: null` exactly as-is.
2) Temporarily disable post-insert email sends in that flow (or guard them behind a request id check that is no longer expected), so booking success is never coupled to row returning.
3) Keep current trigger/RLS architecture unchanged for this hotfix:
   - `link_request_to_existing_user` stays no-op.
   - `INSERT` policy stays account-blind.
   - No broadening of `SELECT` policy.
4) Strengthen observability in the same error block:
   - Keep logging `code/message/details/hint`.
   - Add `auth_state_summary` (`hasSession`, `authUserId`) and a `step` label (`insert_without_returning`) to confirm the new path is running.
5) Validate in test environment:
   - A) logged-in user submits with `elenacalvilloalcalde@gmail.com` → success toast.
   - B) anonymous user submits same email → success toast.
   - C) invalid Substack profile URL still fails with validation message.
6) Confirm persistence with backend query:
   - Verify newest rows for that email exist and `requester_user_id IS NULL`.
7) Publish to live after test passes (test/live are separate environments).
8) Follow-up (non-blocking next patch):
   - Add backend-driven email notification trigger/function so confirmation emails work without relying on frontend row-returning access.
