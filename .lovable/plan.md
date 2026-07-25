## Remove the 3 active projects cap

### Frontend

**`src/lib/access.ts`**
- Keep `ACTIVE_PROJECT_LIMIT` exported but set to `Infinity` (preserves the import surface for tests/hooks without churn), or remove entirely and update callers. Preference: remove.
- `canCreateAnotherProject(activeCount)` → always returns `true`.
- Remove `ACTIVE_PROJECT_LIMIT_MESSAGE` (no longer surfaced).

**`src/hooks/useProjects.ts`**
- Drop `activeLimit` and `activeLimitMessage` from the returned object.
- `canCreate` stays for API compatibility but is always `true`.

**`src/pages/Projects.tsx`**
- Header subtitle: `"{activeCount} active project{activeCount === 1 ? "" : "s"}"` (no `/limit` ratio).
- Remove the amber "at limit" `Card`.
- Remove `disabled` + `title` tooltip on the **New Project** button.
- Remove `disabled` + `title` tooltip on the **Unarchive** button.
- Drop the `toast.error(activeLimitMessage)` guard in `handleNewProject`.

**`src/lib/__tests__/access.test.ts`**
- Remove/update the two assertions that pin `ACTIVE_PROJECT_LIMIT === 3` and the message string.
- Add an assertion that `canCreateAnotherProject(999) === true`.

### Database

A trigger `trg_enforce_active_project_limit` on `public.projects` (backed by `public.enforce_active_project_limit()`) rejects inserts once a creator has 3 active projects. Without dropping this, the frontend change would surface a Postgres error to users trying to create the 4th project.

Migration (schema-only, no data changes):
```sql
DROP TRIGGER IF EXISTS trg_enforce_active_project_limit ON public.projects;
DROP FUNCTION IF EXISTS public.enforce_active_project_limit();
```

### Verification
- Typecheck.
- Run `access.test.ts`.
- Manually confirm creating a 4th active project succeeds after approval.
