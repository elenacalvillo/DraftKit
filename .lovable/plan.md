## Root cause (confirmed from analytics_events)

Every autosave against chapter `d827b1f5…` is failing with Postgres code **42702 — ambiguous column reference**. This started with the previous turn's rewrite of `save_workspace_content`, which added the version-history snapshot block:

```sql
DELETE FROM public.chapter_revisions
WHERE request_id = _request_id
  AND id NOT IN (
    SELECT id FROM public.chapter_revisions
    WHERE request_id = _request_id
    ORDER BY created_at DESC
    LIMIT 30
  );
```

The function is declared `RETURNS TABLE(id uuid, shared_content text, content_last_edited_by text, content_last_edited_at timestamptz)`. Those OUT-parameter names (`id`, `shared_content`, `content_last_edited_by`) are visible as variables inside the function body, so bare `id` in the DELETE / subselect is ambiguous with the OUT parameter `id`. Postgres refuses the whole call, the frontend never gets a success row back, and the editor cycles between "retrying" and "unsaved changes." Every save is failing, not just reviewers — Karen (owner) is hitting it because the ambiguous-column check fires regardless of role.

The `restore_chapter_revision` function has the same shape (`RETURNS TABLE(id, shared_content, ...)` + identical DELETE block) and would blow up the same way the first time an admin tries to restore.

## Fix

Single migration that replaces both functions with the column references disambiguated. No app code changes needed.

### 1. `save_workspace_content`

- Add `#variable_conflict use_column` at the top of the plpgsql body (belt-and-suspenders — makes bare identifiers prefer table columns over OUT params, matching what the original function assumed).
- Qualify every reference to the snapshot table's columns explicitly: `chapter_revisions.id`, `chapter_revisions.request_id`, `chapter_revisions.created_at` inside the retention DELETE and its subselect.
- Keep the outer `RETURNING cr.id, cr.shared_content, cr.content_last_edited_by, cr.content_last_edited_at` (already cr-qualified, safe).
- Behaviour otherwise unchanged: same reviewer guard, same 2-minute snapshot debounce, same 30-revision retention.

### 2. `restore_chapter_revision`

Same treatment — `#variable_conflict use_column` and fully-qualified `chapter_revisions.*` inside the retention DELETE.

### 3. Regression guard

Add one Vitest case in `src/lib/__tests__/save-workspace-errors.test.ts` that maps a `42702` / "ambiguous column reference" message to `reason: "unknown"` with a friendly message that tells the user to reach out — so if this class of RPC failure ever recurs the toast is explicit instead of the generic "critical error." (Pure helper test, no infra.)

## Files touched

- `supabase/migrations/<timestamp>_fix_save_workspace_ambiguous_column.sql` — CREATE OR REPLACE of both functions with the fixes above.
- `src/lib/save-workspace-errors.ts` — add a `postgres_ambiguous_column` bucket (optional polish; only if it stays small).
- `src/lib/__tests__/save-workspace-errors.test.ts` — one added test.

## Out of scope

- No changes to comment-only reviewer logic, chapter_revisions schema, RLS, or grants.
- Not touching the frontend save flow, retry logic, or recovery-draft UX.
- Not backfilling snapshots for the 20+ failed autosaves — Karen's latest content is preserved in her local recovery draft and will save cleanly once the function is fixed.

## Rollout note to share with Karen

After the migration lands, her next edit will succeed and the "Save & Sync" button on the local-recovery banner will push the buffered content up. No data was lost — every failed attempt kept the draft in localStorage.
