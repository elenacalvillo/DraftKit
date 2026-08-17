# Fix "Could not add writer" and the shared Resend invite button

Both causes are confirmed.

## 1. Adding a registered writer fails

The database logs show the real error on every attempt:

```text
42702: column reference "project_id" is ambiguous
```

`add_project_member_by_creator` returns a table whose output column names
(`project_id`, `user_id`, `email`, `role`) collide with the real table columns, so
the `ON CONFLICT (project_id, email)` clause cannot resolve. Nothing to do with
multi-project membership: the unique key is already `(project_id, email)`, so the
same person can belong to many projects.

Fix: add `#variable_conflict use_column` to the function body and rename the
output parameters to non-colliding names (`out_project_id`, etc.), same pattern
already used to fix `save_workspace_content`.

Second, smaller fix: the toast said only "Could not add writer" because Supabase
errors are plain objects, not `Error` instances, so the message was thrown away.
Surface the real message (and the Postgres code) in the toast so a failure like
this is explicit next time.

## 2. Resend invite toggles every row

Every row reads the same `resendInvite.isPending` flag from one shared mutation,
so clicking one button puts all of them in the loading/disabled state. Only one
email was actually sent, the UI just lied.

Fix: track the email currently being resent in local state and disable/spin only
that row.

## Technical notes

- Migration: `CREATE OR REPLACE FUNCTION public.add_project_member_by_creator`
  with renamed OUT columns plus `#variable_conflict use_column`; behaviour,
  authorization checks and role validation unchanged.
- `src/hooks/useProjectMembers.ts`: map the renamed RPC columns back to the
  `ProjectMember` shape; keep the best-effort invite email.
- `src/pages/ProjectDetail.tsx`: `handleAddByCreator` reports the actual error
  text; add `resendingEmail` state driving the per-row Resend button.
- No RLS, storage or sanitization changes.
