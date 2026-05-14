## Goal
Restore workspace image uploads in production for toolbar upload, drag-and-drop, and paste.

## Root cause
The live backend is not using the intended workspace-image policy.

I verified that:
- The frontend is uploading to the correct bucket (`workspace-images`) and building paths as `{request_id}/{timestamp}_{filename}`.
- The bucket exists, is public, and has the right MIME/size settings.
- The live database only applied migration `20260514055953`.
- The active storage policies in production are malformed: they resolve the folder from `storage.foldername(c.name)` instead of `storage.foldername(name)`.

That means the policy is effectively checking the creator’s display name instead of the uploaded object path, so storage rejects the object creation. In production this is surfacing as `404 Object not found` during upload.

## Plan
1. Replace the broken live storage policies on `storage.objects` for `workspace-images`.
   - Drop the current upload/update/delete policies.
   - Recreate them so they scope access from the actual object path using `(storage.foldername(name))[1]::uuid`.
   - Keep access limited to authenticated workspace participants via `public.has_workspace_access(...)`.

2. Add an idempotent migration so the repo matches the fixed live backend.
   - This prevents future environments or restores from reintroducing the broken policy.
   - Keep the bucket config unchanged except for reasserting the correct public/mime/size settings if needed.

3. Validate the backend after the migration.
   - Re-read the active policies from the database and confirm the expression now references `name`, not `c.name`.
   - Confirm the bucket still exists and remains public.

4. Verify the production behavior from the app side.
   - Re-test the upload flow through the existing editor pipeline.
   - Confirm toolbar upload and drag-and-drop no longer return the storage error.

## Technical details
- Affected area: `storage.objects` RLS for bucket `workspace-images`
- Expected rule shape:
  - bucket must equal `workspace-images`
  - first folder in object path must be the workspace/request id
  - current signed-in user must have workspace access through `public.has_workspace_access(auth.uid(), request_id)`
- Frontend changes are likely unnecessary unless validation reveals a second issue after the policy fix.

## Expected outcome
Image insertion should work again in production across all supported paths without changing the editor UX.