## Problem

New signups fail at step 2 with "Failed to create profile." Backend analytics confirm every attempt since at least 2026-06-18 errors with:

> Could not find the function `public.create_creator_profile(...)` in the schema cache

The function is referenced by `src/lib/creator-profile.ts` (called from `Signup.tsx`) and a migration exists at `supabase/migrations/20260519000000_create_creator_profile_rpc.sql`, but `pg_proc` shows zero functions named `create_creator_profile`. The function is missing from the live database, so every signup hits the `rpc_unknown` branch.

## Fix

Add a new migration that re-creates the RPC with the exact signature the frontend calls, plus its grants. Body is identical to the existing `20260519000000_create_creator_profile_rpc.sql`:

- `CREATE OR REPLACE FUNCTION public.create_creator_profile(_username text, _name text, _email text, _substack_url text DEFAULT NULL, _newsletter_url text DEFAULT NULL, _welcome_message text DEFAULT NULL, _join_directory_waitlist boolean DEFAULT false, _profile_image_url text DEFAULT NULL, _referred_by uuid DEFAULT NULL) RETURNS TABLE (id uuid, user_id uuid, username text, name text)` — `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
- Auth guard (`auth.uid()` not null), `username_required` / `email_required` checks.
- Orphan recovery: if a `creators` row already exists for `auth.uid()`, update in place; otherwise check username uniqueness and insert.
- Upsert into `creator_contacts (creator_id, email)` with `ON CONFLICT (creator_id) DO UPDATE`.
- `REVOKE ALL ... FROM PUBLIC` then `GRANT EXECUTE ... TO authenticated`.

## Out of scope

No frontend changes, no schema changes, no RLS changes. `Signup.tsx`, `creator-profile.ts`, and the analytics path stay as-is — they already handle the success and typed-error reasons correctly once the function exists.

## Verification

After the migration runs:
1. `SELECT proname FROM pg_proc WHERE proname = 'create_creator_profile'` returns one row.
2. New signup completes end-to-end in the preview.
3. No new `creator_creation_failed` rows in `analytics_events` with `reason = rpc_unknown`.
