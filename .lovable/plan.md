## Status: feature already shipped

Every line item in the brief already exists in the codebase. Before writing more code, the right move is a focused audit against the acceptance criteria, then targeted fixes only where the audit finds a real gap.

## What is already in place

| Acceptance criterion | Where it lives | Status |
|---|---|---|
| Storage path for workspace images | Migration `20260514120000_workspace_images_storage.sql` creates public bucket `workspace-images`, 10 MB cap, MIME whitelist (jpeg/png/webp/gif) | Done |
| RLS scoped to participants on upload | INSERT/UPDATE/DELETE policies on `storage.objects` gated by `public.has_workspace_access(auth.uid(), foldername(name)[1]::uuid)` | Done |
| Reads work for creators + collaborators | Bucket is public; URL embedded in `shared_content` renders directly | Done |
| No Pro/free gating | Policies check participation only, never tier | Done |
| Path builder + bucket name as importable constants | `src/lib/workspace-images.ts` exports `WORKSPACE_IMAGES_BUCKET`, `buildWorkspaceImagePath`, `uploadWorkspaceImage` | Done |
| Migration file checked in | `supabase/migrations/20260514120000_workspace_images_storage.sql` + a migration test | Done |
| TipTap Image extension on toolbar | `WorkspaceEditor.tsx` imports `@tiptap/extension-image`, registers `Image.configure(...)`, exposes toolbar button (`data-testid="workspace-image-toolbar-button"`) wired to a hidden `<input type="file">` | Done |
| Drag-and-drop + paste | Single `insertImageFile` flow called from both `handlePaste` and `handleDrop` in the editor's `editorProps` | Done |
| Client-side compression to 1 MB | `compressWorkspaceImage` uses `browser-image-compression` (web worker, mime preserved, 1920px max edge) before upload | Done |
| Defense against base64 reaching DB | `uploadWorkspaceImage` refuses any non-`https://` URL; `stripBase64ImageTags` strips legacy data-URI `<img>` on render in `SharedWorkspace.tsx` | Done |
| Tests | `src/lib/__tests__/workspace-images.test.ts` (compression, mime gate, RLS path contract, base64 refusal) + migration test | Done |

## Proposed work (verification audit, no code changes until findings demand them)

### 1. Live RLS smoke test (read-only SQL)
Confirm against the live DB that:
- `workspace-images` bucket exists, is `public`, has the expected `file_size_limit` and `allowed_mime_types`.
- The three named storage policies exist on `storage.objects` and reference `has_workspace_access`.
- A negative probe: simulate an authenticated user uploading to a `request_id` they do NOT participate in — must be denied. (Done by inspecting policy SQL; an actual write probe needs the live preview session.)

### 2. End-to-end click-through in preview
With me in plan mode I cannot run this — but the checks to perform on first build/test pass are:
- Toolbar Image button → file picker → selected JPG → appears inline → page reload still renders from `https://…/storage/v1/...` (NOT a `data:` URL).
- Drag a PNG over the editor → same outcome.
- Paste a screenshot from the OS clipboard → same outcome.
- Open the same workspace as the collaborator account → image is visible.
- Open the public read-only sheet → image still resolves (bucket is public).
- DB sanity: `SELECT shared_content` on the test request contains an `<img src="https://...">`, never `data:image/`.

### 3. Targeted code review focus areas
Where regressions are most likely, given the existing code:

- **`requestId` plumbing**: `uploadWorkspaceImage` throws if `requestId` is empty. Confirm `WorkspaceEditor.tsx` always passes a valid request id (especially for newly-created solo chapter workspaces where the row was just inserted — the same path that broke chapter creation last week).
- **Editor read-only mode**: when `can_edit_workspace` returns false (cancelled/pending), the toolbar Image button must be hidden/disabled so users do not get a confusing "RLS denied" toast. Check that the editor's existing read-only branching covers the new button.
- **Cancellation lifecycle**: when a collab is cancelled, `has_workspace_access` still returns true (participants stay linked), so old images continue to render — confirm this matches product intent (it should: drafts must remain readable for the host).
- **Public read-only viewer**: `PublicWorkspaceView.tsx` consumes `get_public_sheet`. Since the bucket is public, embedded `<img>` tags render fine without auth — confirm no CSP/sandbox attribute on that page strips them.
- **Storage accounting**: workspace images are NOT counted against `creators.storage_used_bytes` (the `increment_storage_used` RPC is only called for project images). The brief's economics assume this. Flag whether to wire it in or leave unmetered (recommend: leave unmetered for now, the cost analysis covers it).

### 4. Only-if-needed hardening (will NOT ship unless audit surfaces a real bug)
- Add a delete hook so `<img>` removed from the editor body also removes the storage object (orphan cleanup). Currently orphans persist forever — acceptable per the cost analysis but worth a memory note.
- Add a toast on `WorkspaceImageError` codes (`file_too_large`, `invalid_format`, `upload_failed`) if the editor currently swallows them.
- Add a Playwright/Vitest integration test that mounts the editor, fires a paste event, and asserts the resulting HTML contains `https://` and not `data:`.

## Deliverable

After audit: a short written report (1) confirming each acceptance-criterion box is checked in production, (2) listing any real bugs found, (3) one PR per real bug with a focused fix + regression test. No speculative refactors.

## Why a plan instead of new code

The feature is already built, tested, and migrated. Re-implementing it now would risk introducing the very "horrendous bugs in production" the brief warns against — duplicate buckets, conflicting RLS, lost migrations. The disciplined move is verify-first, fix-only-what-breaks.

If the audit comes back clean (the most likely outcome based on the code review above), the only remaining work is to mark the ticket done and add a short memory note about the workspace-images bucket so future agents don't re-create it.
