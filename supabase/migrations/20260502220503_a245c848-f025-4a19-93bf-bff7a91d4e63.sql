-- Restore default table grants that were inadvertently revoked.
-- RLS remains the actual access gate; grants only re-enable the ability to query.

-- Authenticated users: full CRUD ability on every public table (RLS still enforces row-level access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Anonymous users: read-only on tables that have explicit anon-facing RLS policies
-- (RLS will still block everything that isn't explicitly allowed for anon)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON public.collab_requests TO anon;
GRANT INSERT ON public.analytics_events TO anon;
GRANT INSERT ON public.user_feedback TO anon;

-- Future tables: keep this from happening again
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
