-- =============================================================
-- Ghost-user recovery email log (Ticket: send-ghost-user-recovery).
--
-- A small audit table the `send-ghost-user-recovery` edge function
-- writes to whenever it sends a "your account is ready, finish
-- setup" reminder to an auth user who has no creators row. Used
-- as the dedup gate so a ghost user is never emailed twice.
--
-- Rows are scoped to a single auth.users row, so the PK is
-- user_id — there is exactly one recovery send per ghost user.
-- The function uses INSERT ... ON CONFLICT DO NOTHING to make the
-- "send if not already sent" path race-safe across retries.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.recovery_emails_sent (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_emails_sent_sent_at_idx
  ON public.recovery_emails_sent (sent_at DESC);

-- Service-role-only table: the edge function is the only writer,
-- and runs with the service key. We still enable RLS as
-- defence-in-depth so the anon/authenticated roles cannot read
-- the send log even if a policy is added by mistake later.
ALTER TABLE public.recovery_emails_sent ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies are declared. With RLS
-- on and no policy, anon + authenticated are blocked outright;
-- service_role bypasses RLS, which is what the edge function uses.
