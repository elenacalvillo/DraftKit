# Fix "Bucket not found" on book cover upload

## What is actually wrong

I checked storage directly. Only two buckets exist: `email-assets` and `workspace-images`. The `project-images` bucket was never created, so every upload from `src/lib/project-cover.ts` and `src/lib/project-images.ts` fails immediately with "Bucket not found". Nothing in the app code is broken and no metadata columns are missing.

Two notes on the suggested fix you pasted:

- The bucket must be created with the platform storage tool, not with `INSERT INTO storage.buckets`. SQL writes to `storage.buckets` are rejected here.
- It should stay **private**, not public. Covers and in-manuscript images belong to unpublished books. Previews and export downloads already use signed URLs (`getCoverUrl`, `downloadCoverBytes`), so a private bucket works with zero code changes and does not leak drafts.

## The fix

1. Create the `project-images` bucket (private) with the storage tool.
2. Add one RLS policy set on `storage.objects` for `bucket_id = 'project-images'`, scoped by the first path segment being the project id:
   - Read: project owner or any project member.
   - Insert / update / delete: project owner or a member with the `admin` role.
   Reuses the existing `is_project_owner()` and `is_project_member()` security definer helpers, matching the pattern already used by `workspace-images`.

## Result

- "Upload cover" works, thumbnail preview renders from a signed URL.
- Chapter inline images (same bucket, `{project_id}/...`) start working too.
- 1 GB cap accounting via `increment_storage_used` is untouched, as is the orphan-object cleanup on failure.

## Technical detail

No frontend changes. One storage bucket creation plus one migration containing only `storage.objects` policies. Path scoping uses `(storage.foldername(name))[1]::uuid` as the project id, so a file can never be written outside a project the user belongs to.
