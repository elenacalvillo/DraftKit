
## What's actually happening

You're saving as the **guest** side. Both a success toast AND an error toast appearing, plus old content coming back, is the textbook signature of an RLS silent reject racing with our new strict check:

- The `UPDATE` to `collab_requests` returns `error = null` but `data = []` (0 rows).
- That means Postgres ran the query, no row matched the guest's UPDATE policy, so nothing was written.
- Old `shared_content` is what's still in the DB → after refresh you see the April 30 version.

For a guest, the only two RLS policies that allow editing `shared_content` are:

1. `Requesters can edit shared workspace` → requires `requester_user_id = auth.uid()` AND `status = 'approved'`.
2. `Collaborators can edit shared workspace content` → requires a row in `workspace_collaborators` for this user AND `status = 'approved'`.

If the Xian collab was originally invited by email and `requester_user_id` was never linked to your auth user (or you're acting via `workspace_collaborators` but the link trigger didn't fire), every guest UPDATE returns 0 rows and your edits never land.

## Plan

### 1. Server-authoritative save via SECURITY DEFINER RPC

Create `public.save_workspace_content(_request_id uuid, _content text, _editor_name text, _editing_sessions jsonb)`:

- `SECURITY DEFINER`, `search_path = public`.
- Inside, explicitly authorize the caller using one source of truth: `has_workspace_access(auth.uid(), _request_id)` AND `status = 'approved'`.
- Auto-link the caller into `workspace_collaborators` / `requester_user_id` if their email matches but the linkage was missed (covers off-platform invite case for Xian).
- `UPDATE collab_requests SET shared_content, content_last_edited_by, content_last_edited_at = now(), editing_sessions WHERE id = _request_id` and `RETURNING ...`.
- Return the updated row. If 0 rows, `RAISE EXCEPTION` with a precise reason: `not_authenticated`, `not_a_participant`, `status_not_approved`, or `request_not_found`.

This eliminates the "silent 0-row" path entirely — every save either commits or throws a typed error.

### 2. Pre-flight permission probe in `SharedWorkspace.tsx`

When the user clicks **Edit Draft** (or on workspace mount for a guest), call a lightweight `can_edit_workspace(_request_id)` RPC that returns `{ can_edit, reason }`. If `can_edit = false`, replace the editor with a clear inline message ("This collaboration isn't currently editable: <reason>") instead of letting the user type for an hour into a doomed save. Disable Save & Sync proactively.

### 3. Switch the client save to the new RPC

In `handleSave`:

- Call `supabase.rpc('save_workspace_content', { ... })` instead of the direct `update().select()`.
- Treat any thrown error as critical (preserve recovery draft, show CRITICAL toast with the exact reason).
- Treat any returned row as the canonical save (clear recovery draft, success toast).
- Remove the previous "row count" guesswork — the RPC enforces it.

### 4. Stop the duplicate-toast bug

Right now, the new "0 rows" branch throws and the catch shows an error toast — but the optimistic `onContentSaved` was already firing in some paths, and earlier code briefly showed a success toast. Audit the save flow so success and error toasts are mutually exclusive: success only after the RPC returns a confirmed row, error otherwise. Nothing in between.

### 5. Repair Xian's record (one-shot data fix)

As part of the migration, run a backfill that:

- Finds `collab_requests` rows where `requester_user_id IS NULL` but `requester_email` matches an `auth.users.email` (normalized) and links them.
- Stamps `joined_at` on `workspace_collaborators` rows similarly.

This makes the existing Xian workspace immediately editable for you again without manual intervention.

### 6. Confirm messaging isolation (no code change expected)

Re-verify in `Workspace.tsx` that opening/sending via `GuestMessageModal` does not bump any state that recreates `<SharedWorkspace />` while the editor has unsaved content. The memo + scoped `msgRefreshKey` already does this; we'll just add a regression note.

## Files in scope

- `supabase/migrations/<new>.sql` — `save_workspace_content` RPC, `can_edit_workspace` RPC, link backfill.
- `src/components/requests/SharedWorkspace.tsx` — switch to RPC, add pre-flight gate, tighten toast logic.
- `src/pages/Workspace.tsx` — pass through pre-flight result, keep messaging isolated from editor.

## Validation

- Guest with linked `requester_user_id` → edit + save → exactly one success toast, DB row updated, recovery cleared.
- Guest whose `requester_user_id` was NULL → backfill links them → save succeeds.
- Guest on a `cancelled` collab → pre-flight blocks editing with clear reason; no editor opens.
- Force a 0-row scenario (e.g. wrong status) → RPC throws typed error → CRITICAL toast with reason, recovery draft preserved, no false success.
- Send a workspace message mid-edit → editor content untouched, no remount.
