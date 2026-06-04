## Diagnosis
The `/m` explanation is not the current culprit: `src/lib/markdown-paste.ts` already uses multiline-aware regexes for headings, lists, blockquotes, thematic breaks, and setext lines.

The more likely failure point is the insertion step in `src/components/requests/WorkspaceEditor.tsx`: after markdown is detected and converted to sanitized HTML, the code manually wraps that HTML in a `<div>`, runs ProseMirror `parseSlice(...)`, and dispatches `replaceSelection(...)`. That manual block insertion path is brittle for multi-block HTML and can fail while paste falls back to plain text behavior.

## Plan
1. Keep the markdown detection helper as-is unless testing proves a specific pattern is still missing.
2. Replace the manual ProseMirror `DOMParser` + `parseSlice` + `replaceSelection` insertion path with TipTap’s supported `editor.commands.insertContent(...)` flow so converted markdown HTML is inserted through the editor’s normal parser.
3. Remove the now-unused ProseMirror DOM parser import.
4. Add a minimal temporary debug signal around markdown paste handling so we can confirm the markdown branch is actually triggered during paste.
5. Validate against the exact `.md`-style content you pasted: headings, `---`, italics, lists, and blockquotes should render as blocks instead of raw text.

## Technical details
- File: `src/components/requests/WorkspaceEditor.tsx`
  - Update the markdown branch inside `handlePaste(...)`.
  - Use the existing editor instance (`editorRef.current`) and call `insertContent(converted, { parseOptions: { preserveWhitespace: false } })` after `event.preventDefault()`.
- File: `src/lib/markdown-paste.ts`
  - No planned regex changes unless a concrete missed token shows up during verification.
- Constraints preserved:
  - No change to image handling.
  - No change to sanitization policy.
  - No change to storage behavior or document-retention rules.
  - Markdown-generated HTML remains limited to the existing whitelist, so this stays compliant with the editor sanitization constraint.

## Compliance check
- **Read constraints:** checked the project root for `CLAUDE.md`; it is not present.
- **Active rules audited:** this investigation does not touch workspace access enforcement or public creator-column exposure.
- **Conflicts found:** none with the 1 GB storage cap, the sanitization whitelist, or the in-app editing mandate.