# Fix markdown formatting being pasted as literal asterisks

## What's happening

Pasted text like `**5. What changed (the after)**` stays as raw asterisks instead of becoming bold. Two confirmed causes in the editor's paste handler (`src/components/requests/WorkspaceEditor.tsx`):

1. **Any HTML clip short-circuits everything.** The handler returns early whenever the clipboard carries a `text/html` payload. Many sources (ChatGPT plain copy, Notes, Slack, terminals, plain-text editors) attach a `text/html` clip that is just the same raw markdown wrapped in `<pre>`/`<span>`/`<div>` with no real formatting. Tiptap then inserts the asterisks verbatim.
2. **Only block-level markdown is detected.** The plain-text branch calls `hasStructuralMarkdown`, which matches headings, bullets, quotes and code fences only. Inline markdown (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`) is never converted. The inline-aware `looksLikeMarkdown` helper already exists in `src/lib/markdown-paste.ts` but is imported and unused.

The earlier "can't paste anything" and "Google Doc pasted as image" fixes are what narrowed this path; the fix below keeps both of those behaviours intact.

## The fix

1. Add a `htmlIsPlainTextWrapper(html, text)` helper: true when the HTML clip carries no real formatting elements (no `strong/em/b/i/h1-h6/ul/ol/li/table/a/img/blockquote/code`) and its text content matches the `text/plain` payload. Rich clips from Docs, Word, Notion, Substack keep taking the existing HTML path untouched.
2. In `handlePaste`, only return early for HTML when it is genuinely rich. When the HTML is a plain-text wrapper, fall through to the markdown branch.
3. In the markdown branch, use `looksLikeMarkdown` (inline + structural) instead of `hasStructuralMarkdown`, so `**bold**`, `*italic*`, inline code and markdown links convert too. Ordinary prose still contains no markdown tokens, so it keeps pasting as plain text.
4. Keep image-only paste, reviewer comment-mode block, and the no-base64 upload pipeline exactly as they are.

Also worth confirming while in the file: typing `**bold**` inline should already convert via StarterKit input rules; if it does not after this change, that is a separate follow-up.

## Technical notes

- Files touched: `src/components/requests/WorkspaceEditor.tsx`, plus a small export addition in `src/lib/markdown-paste.ts` if the wrapper helper lives there.
- `markdownToSanitizedHtml` already sanitizes via DOMPurify with the workspace whitelist and strips images, so the storage cap and no-base64 rules stay enforced.
- Add unit tests for the new wrapper detection and for inline-only markdown conversion under `src/lib/__tests__/`.
- No database, RLS, or edge function changes.
