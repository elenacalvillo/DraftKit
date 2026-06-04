## Problem

Pasting markdown into the Shared Workspace editor leaves the raw syntax (`#`, `##`, `**bold**`, `- item`, `---`, etc.) as literal text. Nothing gets formatted, as visible in the screenshot of "Prólogo".

Root cause: `WorkspaceEditor.tsx` uses Tiptap's `StarterKit` with no markdown handling. Tiptap only converts pasted **HTML**, not plain-text markdown. When the user copies from a `.md` file or another markdown source, the clipboard only carries `text/plain`, so it lands verbatim.

## Plan

1. **Add a markdown parser dependency**
   - Install `marked` (small, fast, well-maintained, MIT). Used only client-side inside the editor paste handler.

2. **Markdown detection helper** (`src/lib/markdown-paste.ts`)
   - `looksLikeMarkdown(text: string): boolean` — true if the pasted text contains any of: ATX headings (`^#{1,6} `), setext underlines (`^=+$` / `^-+$`), thematic break (`^---$`), list markers (`^[-*+] `, `^\d+\. `), blockquote (`^> `), fenced code (` ``` `), bold/italic (`**…**`, `*…*`, `__…__`), inline code (`` `…` ``), links `[x](http…)`, or images `![…](…)`.
   - `markdownToSanitizedHtml(md: string): string` — runs `marked.parse(md, { gfm: true, breaks: false })` then passes the result through the existing DOMPurify config used elsewhere (same `ALLOWED_TAGS` / `ALLOWED_ATTR` as `PublicWorkspaceView`, restricted to the workspace whitelist: headings h1–h3, p, strong, em, s, code, pre, a, ul, ol, li, br, hr, blockquote, table tags). Strip `<img>` from markdown paste (images must go through the existing upload pipeline to honor the 1 GB storage and no-base64 rules) and strip `data:` URIs.

3. **Wire it into the paste plugin** (`WorkspaceEditor.tsx`, inside `imageUploadPlugin`)
   - Add a `handlePaste` branch that runs **before** the existing image check:
     - If `event.clipboardData` has `text/html` → let Tiptap handle it (return false). This preserves rich paste from web pages.
     - Else if it has `text/plain` AND `looksLikeMarkdown(text)` is true:
       - `event.preventDefault()`
       - Convert to sanitized HTML
       - Insert via `editor.commands.insertContent(html, { parseOptions: { preserveWhitespace: false } })` using the view's dispatch
       - Return `true`
     - Otherwise return `false` (fall through to existing image handler and default plain-text paste).
   - Rename the plugin to `workspacePastePlugin` since it now handles more than images. Keep image drop/paste behavior unchanged.

4. **No backend / schema / sanitizer-whitelist changes.** The output stays inside the existing DOMPurify whitelist used on save (`src/lib/save-workspace-errors.ts` / workspace save path) so nothing new is allowed through.

5. **Verify**
   - Paste the exact Prólogo markdown from the screenshot → headings, hr, paragraphs, emphasis render correctly.
   - Paste a list / fenced code / blockquote → renders as list / code block / quote.
   - Paste plain prose (no markdown tokens) → behaves like before (plain text).
   - Paste rich HTML from a webpage → unchanged (Tiptap handles it).
   - Paste an image → unchanged (existing upload path).
   - Save & reload → formatting persists (sanitizer already permits these tags).

## Out of scope

- Markdown **export** (Copy / Download already exist as HTML/docx).
- A "paste as markdown" toggle UI — detection is automatic and conservative.
- Changes to the public viewer, mobile, or any other surface.
