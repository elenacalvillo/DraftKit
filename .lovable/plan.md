## Plan

1. Move markdown paste into top-level `editorProps.handlePaste` (priority kill switch)
   - Define `handlePaste(view, event)` directly inside the `useEditor` config so it runs before any extension plugin or browser default.
   - First line: `console.log('--- RAW PASTE INTERCEPTED ---', { hasText: !!text })` to prove the handler fires.
   - Read `text/plain`, run `hasStructuralMarkdown(text)`.

2. Enforce the kill switch when markdown is detected
   - Call `event.preventDefault()` BEFORE inserting, to stop the browser from also dumping raw `#` / `---` text.
   - Convert with `markdownToSanitizedHtml(text)` and insert via `editor.commands.insertContent(html)` (using the captured editor ref).
   - Explicitly `return true` to terminate the paste event chain so nothing else (browser default, other plugins) can run after us.
   - Log `'!!! FORCING MARKDOWN CONVERSION !!!'` right before insertion for clear console evidence.

3. Keep image paste working without blocking markdown
   - Run the image-file check first (existing workspace upload path). If an image is found, handle it and `return true`.
   - If no image and no markdown match, `return false` so normal plain-text paste continues to work.
   - The existing image upload ProseMirror plugin stays in place for drop events and as a safety net, but markdown decisions now live in the top-level handler.

4. Remove the duplicate `link` extension registration
   - Investigate the `[tiptap warn]: Duplicate extension names found: ['link']` warning.
   - StarterKit v3 may already register `link`; if so, drop the standalone `Link` import OR disable `link` in `StarterKit.configure({ link: false })` so only one `Link` extension is active. Pick whichever path lets us keep the current `openOnClick: false` + `validate` config.
   - Confirm the warning disappears so custom plugins are no longer at risk of being ignored due to a messy extension chain.

5. Validate end-to-end with the actual failing paste
   - Reload, open console, paste the Prólogo `.md` content.
   - Required console evidence: `--- RAW PASTE INTERCEPTED ---` appears, then `!!! FORCING MARKDOWN CONVERSION !!!`, and the document renders real headings / horizontal rules / lists instead of literal `#` and `---` characters.
   - If interception fires but rendering still fails, fall back to inspecting the converted HTML output before insertion.

## Technical details

- Primary file: `src/components/requests/WorkspaceEditor.tsx`
- Supporting file (read-only unless heuristic needs a tweak): `src/lib/markdown-paste.ts`
- Editor shape after change:

```text
useEditor({
  extensions: [...one Link only...],
  editorProps: {
    attributes: { ... },
    handlePaste(view, event) {
      // 1. image file? handle + return true
      // 2. text/plain + hasStructuralMarkdown?
      //      event.preventDefault()
      //      editor.commands.insertContent(markdownToSanitizedHtml(text))
      //      return true   <-- kill switch
      // 3. otherwise return false
    }
  }
})
```

- No backend, schema, RLS, storage, or sanitization-policy changes.
- DOMPurify whitelist and no-base64 image rule remain untouched.

## Compliance check

- **Read Constraints:** Scanned the project root for `CLAUDE.md` — not present; followed in-prompt project rules instead.
- **Audit Active Rules:** No changes to `has_workspace_access`, public column exposure, or realtime policies. Editor sanitization whitelist preserved.
- **Verify Compliance:** This change does not conflict with the 1 GB storage cap, the editor sanitization whitelist, or the in-app document retention mandate.