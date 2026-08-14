# Repair missing book cover storage

## Confirmed investigation

- The cover UI calls `uploadProjectCover()`, which uploads to the `project-images` bucket at `{project_id}/cover/{timestamp}_{filename}`.
- The live backend has only `email-assets` and `workspace-images`. `project-images` does not exist, so storage returns the exact **“Bucket not found”** error before the project metadata update runs.
- The live backend has no `storage.objects` policies for `project-images` either.
- The repository contains an old `20260502120300_book_projects_storage.sql` file intended to create that bucket and its policies, but its version is absent from live migration history. It was never applied.
- The newer book metadata migration did run. The project columns for the cover path, MIME type, byte count, author, ISBN, and language exist. All nine current projects have a null cover path because no upload has reached that step.
- The app already expects a **private** bucket: previews use one-hour signed URLs and exports download the authenticated object bytes. Making it public is unnecessary and would expose unpublished book assets.

## Important safety finding

Do not apply the old storage migration wholesale. Besides using a bucket-creation method that is no longer accepted by the platform, it contains an older `increment_storage_used()` definition. Reapplying that function would replace the current owner-validated implementation and weaken the 1 GB accounting protection.

## Safe fix

1. Create `project-images` with the native storage tool as a private bucket, with a 10 MB limit and JPEG, PNG, WebP, and GIF MIME types. Covers remain restricted in the UI to JPEG and PNG.
2. Apply a focused migration containing only `storage.objects` policies:
   - Select: project owner or project member.
   - Insert, update, and delete: project owner.
   - Every rule must require `bucket_id = 'project-images'` and derive the project id from the first object-path segment.
3. Leave the current `increment_storage_used()` function, project tables, and frontend upload logic unchanged.
4. Verify with a real authenticated owner upload that the object is created, storage usage increases, project metadata saves, and the signed thumbnail renders. Then remove the test cover and verify the object and byte count are both reversed.

## Constraint check

- **1 GB cap:** Preserved through the current owner-validated accounting RPC and orphan cleanup.
- **Sanitization whitelist:** No conflict. This repairs project asset storage and does not change editor HTML handling.
- **In-app retention:** No conflict. Covers remain inside DraftKit storage and exports.
- **Access model:** Project paths use project ownership and membership checks. Workspace access rules and public creator-column exposure are not changed.
