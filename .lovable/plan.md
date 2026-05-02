# Restore broken table grants (data is safe)

## Diagnosis

Your account `e12cb16e…` still has its full creator profile (`elenacalvillo`, "Elena Calvillo", created Jan 9). The other test account is also intact. **No data was lost.**

The recent security migration that tried to switch `creators` to column-level GRANTs ended up revoking all privileges from `anon` and `authenticated`. Current state:

```
public.creators grants → only sandbox_exec has SELECT/INSERT
authenticated → (nothing)
anon          → (nothing)
```

In Postgres, RLS runs *after* table grants. No grant = no rows returned, even when RLS would allow it. That's why `fetchCreator()` in `useAuth.tsx` returns `null` and `ProtectedRoute` bounces you into `/signup` onboarding.

The same migration likely also stripped grants on other tables touched by the security pass (`collab_requests`, workspace tables, etc.), which would explain the earlier "can't see Dinah's collabs" report.

## Fix

A single migration that restores standard table-level grants while keeping RLS as the actual access gate.

1. **`creators`** — grant `SELECT, INSERT, UPDATE, DELETE` to `authenticated`. RLS already restricts to `auth.uid() = user_id` for read/update/delete. No grant to `anon` (public profile data is now served via the `creators_public` view per the earlier security work).
2. **Audit & restore grants** on every table the security migrations touched. I'll enumerate `information_schema.role_table_grants` for `public.*` and re-grant the standard CRUD set to `authenticated` wherever it was wiped, leaving `anon` only where a public-facing view/policy exists.
3. **Verify the `creators_public` view** still has `SELECT` granted to `anon, authenticated` so public booking pages keep working.
4. **Smoke test** after deploy: confirm `select * from creators where user_id = auth.uid()` returns the row when impersonating an authenticated user, and confirm `/dashboard` no longer redirects to `/signup`.

## Why this is safe

- Grants only re-enable the *ability* to query; RLS policies (already in place: `Creators can view own profile`, etc.) continue to enforce row-level access.
- No schema changes, no data writes, no policy edits — purely restoring privileges that should never have been removed.
- The "zombie policy" cleanup from the security memory is preserved; we are not re-introducing the old `Public profile columns readable` policy.

## Out of scope (separate follow-ups)

- The `1970-01-01` timestamps you saw — likely a `to_timestamp(0)` default or null-coalesce somewhere; I'll investigate after your account is unblocked.
- Analytics event coverage audit — track separately once you're back in.
