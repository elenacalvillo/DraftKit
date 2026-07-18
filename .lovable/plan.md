## Bug confirmed

In `src/components/requests/WorkspaceEditor.tsx`, the top-level `handlePaste` (and the ProseMirror plugin's `handlePaste`) both check for an image file in `clipboardData` **before** checking for `text/html`. When a user copies from Google Docs, the clipboard contains:

- `text/html` — the real formatted document
- `text/plain` — plain fallback
- `image/png` — a rendered screenshot of the selection (Google Docs always attaches this)

Because we look for an image first, we upload the screenshot and discard the HTML. This is exactly what Blessing hit.

## Fix

Reorder the paste priority so image insertion only happens when the clipboard is **image-only** (no usable text payload). Drag-and-drop and the toolbar image button stay unchanged — they remain the explicit paths for inserting an image.

### Changes to `src/components/requests/WorkspaceEditor.tsx`

1. Add a small helper `clipboardHasText(dt)` returning true when either `text/html` or a non-empty `text/plain` is present.
2. In the top-level `editorProps.handlePaste`:
   - Keep reviewer-mode guard as step 0.
   - New step 1: if `text/html` is present and non-empty → `return false` (let Tiptap's HTML pipeline run). This wins over the image branch.
   - Step 2: if an image file is in the clipboard **and** there is no text/html and no meaningful text/plain → run the existing `insertImageFileRef` upload path.
   - Step 3: plain-text markdown detection (unchanged).
   - Step 4: fall through (unchanged).
3. In the ProseMirror plugin's `handlePaste` (the safety-net layer):
   - Same guard: only treat as an image paste when the clipboard has no text payload. Otherwise return `false` so Tiptap handles the HTML/text normally.
4. `handleDrop` in the plugin is **unchanged** — drag-and-drop of an image file is still an explicit image insert, matching the ticket's requirement.

### Result

- Paste from Google Docs → HTML lands, formatted, editable. Screenshot is ignored.
- Paste from Substack / Notion / Gmail → unchanged (already HTML-first now, but this makes it explicit).
- Copy an image from Preview / a browser and paste → still uploads as an image (clipboard is image-only).
- Screenshot to clipboard + Cmd+V → still uploads (image-only).
- Drag-drop an image file → still uploads.
- Toolbar image button → still uploads.

### Verification

- Manually paste a Google Docs selection into the workspace editor in the preview and confirm formatted text appears (no image node).
- Paste a Finder-copied PNG and confirm it still uploads via the workspace-images pipeline.
- Existing paste tests under `src/components/requests/__tests__` (if any cover the editor) still pass; add a lightweight unit test around a `clipboardHasText`-style helper if we extract it.

No schema, RLS, or edge function changes. Purely frontend paste-priority reorder.
