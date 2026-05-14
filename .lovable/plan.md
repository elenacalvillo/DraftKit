# Plan: Fix workspace image upload payload on the frontend

## What I’ll change
1. Update `src/lib/workspace-images.ts` so `compressWorkspaceImage()` always converts the compression result into a brand-new `File` before upload, even if `browser-image-compression` already returns a `File`.
2. Preserve the original filename and MIME type explicitly on that normalized `File`, and stamp a fresh `lastModified` value so the upload payload is consistent in production.
3. Tighten the existing unit tests in `src/lib/__tests__/workspace-images.test.ts` to cover both return paths:
   - compressor returns a `Blob`
   - compressor returns a `File`, but we still re-wrap it into a clean `File`

## Why this targets the reported bug
- The failing request is the storage `POST` itself, before any database write, which points at the uploaded object payload rather than RLS or URL generation.
- The current helper only wraps the result when the compression library returns a `Blob`.
- If production returns a `File` object with incomplete or unstable metadata, that object currently goes straight into `storage.upload()`. Normalizing every compressed result removes that inconsistency.

## Scope guard
- No database changes
- No storage policy changes
- No backend commands
- No editor UX changes outside the upload helper/tests

## Technical details
- File to update: `src/lib/workspace-images.ts`
- Test file to update: `src/lib/__tests__/workspace-images.test.ts`
- Expected implementation shape:
```ts
const compressedBlob = await imageCompression(file, options);
return new File([compressedBlob], file.name, {
  type: file.type,
  lastModified: Date.now(),
});
```
- I’ll preserve the current size/type/public URL behavior and keep the rest of the upload pipeline untouched.