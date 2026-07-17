## Problem

Karen sees `column reference "id" is ambiguous` when moving a chapter. The `move_chapter_to_project` RPC declares `RETURNS TABLE(id uuid, project_id uuid, chapter_order integer)`. In PL/pgSQL, `RETURNS TABLE` column names are in scope as OUT parameters throughout the function body, so `WHERE id = _chapter_id` and the `UPDATE ... WHERE id = _chapter_id` collide with the OUT `id`, and `chapter_order = chapter_order - 1` collides with the OUT `chapter_order`. Postgres raises "column reference 'id' is ambiguous".

## Fix

Ship a single migration replacing `public.move_chapter_to_project` with:

- Rename the OUT columns so they can't shadow table columns: `RETURNS TABLE(moved_chapter_id uuid, moved_project_id uuid, moved_chapter_order integer)`.
- Alias `public.collab_requests` in every statement (`cr`) and fully qualify every column (`cr.id`, `cr.project_id`, `cr.chapter_order`, `cr.is_project_workspace`) — including the two `UPDATE`s and the final `RETURN QUERY`.
- Keep all existing behavior: auth check, ownership check on both projects via `is_project_owner`, append to end of destination, re-index the source, same error codes.

No frontend changes needed — `MoveChapterDialog` only checks `error` from the RPC and doesn't read the returned columns.

## Validation

- After migration, re-run Karen's move: no ambiguity error, chapter appears at end of destination project, source project re-numbers correctly.
- Confirm `SELECT * FROM public.move_chapter_to_project('<chapter>','<target>')` returns one row with the new order.
