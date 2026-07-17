## Ship both now: unread indicators + Move Chapter to Project

### Part A — Backend: unread + activity sort

1. **New table `workspace_reads`**
   - Columns: `user_id uuid`, `request_id uuid`, `last_read_at timestamptz default now()`, PK `(user_id, request_id)`.
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_reads TO authenticated;`
   - `GRANT ALL ON public.workspace_reads TO service_role;`
   - RLS: single policy `user_id = auth.uid()` for all operations.

2. **RPC `mark_workspace_read(_request_id uuid)`**
   - `SECURITY DEFINER`, `search_path = public`.
   - Verifies `has_workspace_access(auth.uid(), _request_id)`; upserts `last_read_at = now()`.

3. **Extend `list_my_workspaces()`**
   - Bind current user's email via `auth.jwt() ->> 'email'` (no `auth.users` join — that schema is off-limits to authenticated executions).
   - Lateral subquery per request against `collaboration_messages` for `last_message_at`.
   - Left-join `workspace_reads` on `(auth.uid(), request_id)`.
   - Add columns `last_message_at`, `unread_message_count` (count of `collaboration_messages` where `created_at > COALESCE(last_read_at, '-infinity'::timestamptz)` AND `sender_email <> (auth.jwt() ->> 'email')`).
   - Final `ORDER BY GREATEST(content_last_edited_at, last_message_at, approved_at, created_at) DESC NULLS LAST`.

### Part B — Backend: Move Chapter to Project

4. **RPC `move_chapter_to_project(_chapter_id uuid, _target_project_id uuid)`**
   - `SECURITY DEFINER`, `search_path = public`.
   - Load chapter; assert `is_project_workspace = true` and `project_id IS NOT NULL`.
   - Assert `is_project_owner(auth.uid(), source_project_id)` AND `is_project_owner(auth.uid(), _target_project_id)`; else raise `not_authorized`.
   - Reject when source == target.
   - `new_order = COALESCE(MAX(chapter_order),0)+1` on target.
   - `UPDATE collab_requests SET project_id = _target_project_id, chapter_order = new_order WHERE id = _chapter_id;`
   - Re-index source: `UPDATE collab_requests SET chapter_order = chapter_order - 1 WHERE project_id = old_project_id AND is_project_workspace = true AND chapter_order > old_order;`
   - Returns `(id, project_id, chapter_order)`.
   - Messages, collaborators, presence, drafts, retro, view_token all follow via `collab_requests.id`.

### Part C — Frontend: unread badge + auto-mark-read

5. **`useMyWorkspaces.ts`** — add `last_message_at: string | null` and `unread_message_count: number` on `MyWorkspace`.

6. **`Collaborations.tsx` `WorkspaceRow`** — when `unread_message_count > 0`, render a coral pill "N new" next to role badges.

7. **`SharedWorkspaceCard.tsx`** (Dashboard Recent feed) — same "N new" pill when the underlying record has unread.

8. **`Workspace.tsx`** — after the request loads for the current user, call `supabase.rpc('mark_workspace_read', { _request_id: requestId })` once, then `queryClient.invalidateQueries({ queryKey: ['my_workspaces'] })`.

### Part D — Frontend: Move Chapter to Project

9. **New `src/components/projects/MoveChapterDialog.tsx`**
   - Props: `chapterId`, `currentProjectId`, `open`, `onOpenChange`, `onMoved(targetProjectId)`.
   - `useProjects()` list, filter out `currentProjectId`. If none available, disable trigger.
   - shadcn `Dialog` + `RadioGroup` of destinations; Confirm disabled until picked.
   - On confirm: RPC call → toast → invalidate `['project_chapters', currentProjectId]`, `['project_chapters', targetId]`, `['my_workspaces']` → call `onMoved(targetId)`.

10. **`ProjectDetail.tsx`**
    - Add "Move to project…" in the chapter row `MoreVertical` menu (hidden when only one project exists).
    - `onMoved`: just close the dialog (row disappears from the current list once the query refreshes). Optional toast action "Open destination →" that navigates to `/dashboard/projects/{targetId}`.

11. **`Workspace.tsx` (editing view path)**
    - Also expose "Move to project…" in the workspace header overflow menu when the current request is a project chapter and the user owns the parent project.
    - `onMoved(targetId)`: since the current URL is scoped to the parent project chapter navigator, immediately `navigate('/dashboard/projects/' + targetId, { replace: true })` to avoid a 404-style stale state.

### Notes

- `auth.jwt() ->> 'email'` — do not query `auth.users`; it triggers a permission error even under SECURITY DEFINER without explicit grants.
- `enforce_collaborator_field_restrictions` doesn't freeze `project_id` for the host branch, and the RPC runs `SECURITY DEFINER` anyway; ownership check inside the RPC is the enforcement.
- Re-index is a single UPDATE, safe for the expected single-owner concurrency.

### Files touched

- Migration: `workspace_reads` + `mark_workspace_read` + updated `list_my_workspaces` + `move_chapter_to_project`.
- `src/hooks/useMyWorkspaces.ts`
- `src/pages/Collaborations.tsx`
- `src/components/requests/SharedWorkspaceCard.tsx`
- `src/pages/Workspace.tsx`
- `src/components/projects/MoveChapterDialog.tsx` (new)
- `src/pages/ProjectDetail.tsx`
