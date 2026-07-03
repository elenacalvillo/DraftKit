
## The bug

`src/components/requests/WorkspaceEditor.tsx` (lines 329-363) runs `hasStructuralMarkdown` on the clipboard's `text/plain` fallback. When users paste from Substack, Google Docs, Notion, Gmail, or another browser tab, the clipboard carries BOTH:

- `text/html` — the real rich content (headings, bold, links, lists)
- `text/plain` — a degraded ASCII copy that almost always contains `- `, `* `, `1. `, or `> ` lines

Our handler sees the plain-text markers, calls `preventDefault()`, throws away the rich HTML entirely, and runs `markdownToSanitizedHtml` on the ASCII fallback. Result: pastes come in mangled or empty and users think paste is broken.

## Fix

Only run the markdown conversion path when the clipboard is genuinely plain text (no `text/html` payload). If `text/html` exists, let Tiptap's built-in HTML paste pipeline handle it — that path is already sanitized by the DOMPurify allow-list at save time and by Tiptap's schema on insertion.

### Change in `src/components/requests/WorkspaceEditor.tsx` (handlePaste, ~lines 329-363)

1. Image branch stays unchanged (first priority).
2. Before invoking `hasStructuralMarkdown`, read `event.clipboardData?.getData("text/html")`. If it is non-empty, `return false` and let Tiptap handle the rich paste normally.
3. Only when `text/html` is empty AND `text/plain` matches `hasStructuralMarkdown`, convert via `markdownToSanitizedHtml` (existing behavior for genuine markdown pastes from a plain-text editor, terminal, or `.md` file).
4. Remove the noisy `console.log("--- RAW PASTE INTERCEPTED ---")` and `!!! FORCING MARKDOWN CONVERSION !!!` debug logs — they were left in from debugging.

### Not changing

- The image-file paste/drop guard (base64 protection).
- `markdown-paste.ts` helpers or the `DOMPurify` allow-list.
- Any RLS, edge function, or storage logic.

### Verification

- Manual paste tests once implemented:
  - Paste plain prose → appears as text (was already working, must still work).
  - Paste a Substack article → rich HTML preserved (currently broken).
  - Paste a Google Docs bulleted list → list preserved (currently broken).
  - Paste raw markdown from a `.md` file / terminal (no HTML clip) → still converts to formatted HTML.
  - Paste an image from clipboard → still routes through the workspace upload pipeline.
- Existing unit tests in `src/lib/__tests__/` continue to pass; add no new tests unless the diff warrants it.
