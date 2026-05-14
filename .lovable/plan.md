## Real bug

The `workspace-images` bucket and policies exist in the live DB, but every upload still 403s with `new row violates row-level security policy` — even when the authenticated user owns the workspace and `public.has_workspace_access(uid, request_id)` returns `true` from `psql`.

Network proof (just captured):

```
POST /storage/v1/object/workspace-images/06a5895a-…/1778737103550_…png
JWT sub  = e12cb16e-0046-44c4-ad5c-11e03443638d   (matches requester_user_id)
Body     = compressed image
Response = 403 "new row violates row-level security policy"
```

DB proof:

```sql
SELECT public.has_workspace_access(
  'e12cb16e-0046-44c4-ad5c-11e03443638d',
  '06a5895a-9991-4506-92f1-02fb7c97b87f'
);
-- → true
```

So the function is correct, the data is correct, the JWT is correct — yet the policy still rejects.

## Root cause

Storage's RLS evaluator does not always propagate `auth.uid()` into a `SECURITY DEFINER` helper called from a `storage.objects` policy. It is a known Supabase pattern: when policies need to consult `public` tables, the reliable approach is to:

1. Wrap `auth.uid()` in a subquery (`(SELECT auth.uid())`) — the Supabase-documented performance + correctness pattern that lets Postgres evaluate the JWT claim once per row in the right context.
2. Inline the participation check as `EXISTS` subqueries against `collab_requests`, `creators`, and `workspace_collaborators` — so the storage RLS evaluator never has to cross the SECURITY DEFINER boundary.

The same `has_workspace_access` helper continues to work fine for table-level policies on `collab_requests`, `workspace_presence`, etc. The change is scoped to the three storage policies only.

## Fix (one migration)

Drop the three `workspace-images` storage policies and recreate them with inline EXISTS checks. Behaviour stays identical: any signed-in user who is the host (creator), the requester, or a workspace collaborator can read/write/delete images under `{request_id}/...`. No tier gating.

```sql
DROP POLICY IF EXISTS "Workspace participants can upload workspace images" ON storage.objects;
DROP POLICY IF EXISTS "Workspace participants can update workspace images" ON storage.objects;
DROP POLICY IF EXISTS "Workspace participants can delete workspace images" ON storage.objects;

-- Helper expression reused in INSERT/UPDATE/DELETE:
--   path's first folder = request_id
--   AND user is host OR requester OR collaborator on that request
-- All evaluated inline so the storage RLS evaluator sees auth.uid() directly.

CREATE POLICY "Workspace participants can upload workspace images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workspace-images'
  AND EXISTS (
    SELECT 1 FROM public.collab_requests cr
    LEFT JOIN public.creators c ON c.id = cr.creator_id
    WHERE cr.id = ((storage.foldername(name))[1])::uuid
      AND (
        c.user_id = (SELECT auth.uid())
        OR cr.requester_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_collaborators wc
          WHERE wc.request_id = cr.id
            AND wc.user_id = (SELECT auth.uid())
        )
      )
  )
);

-- Same body for UPDATE (USING + WITH CHECK) and DELETE (USING).
```

I will also defensively guard the path cast: if `(storage.foldername(name))[1]` cannot be cast to a UUID the policy returns false instead of erroring (wrap in a `safe_cast` CTE pattern or use a regex pre-check). This prevents a malformed path from blowing up future uploads.

## Verification (after migration)

1. Re-run the failing drag-and-drop and toolbar upload from the same workspace — expect `201`.
2. Re-test from a *different* logged-in account that is NOT a participant of that request — expect `403` (RLS still protects unrelated workspaces).
3. Confirm `<img src="https://…/storage/v1/object/public/workspace-images/…">` lands in `shared_content` (no `data:` URI).
4. Reload the page — image still renders from the public URL.

## Out of scope

- No client code changes — `src/lib/workspace-images.ts` and `WorkspaceEditor.tsx` are correct.
- No changes to `has_workspace_access` — it stays as the source of truth for table-level policies.
- No new toast copy or UI changes.
