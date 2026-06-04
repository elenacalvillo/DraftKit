## Compliance check
- **Read Constraints:** Scanned the project root for `CLAUDE.md`; it is **not present**.
- **Audit Active Rules:** I will preserve the existing workspace access guard pattern and the restricted public creator-column exposure; this investigation is frontend-only.
- **Verify Compliance:** No requested changes conflict with the 1 GB storage cap, the editor sanitization whitelist, or the in-app document-retention mandate.

## What I found
- The current editor already checks `text/plain` + `hasStructuralMarkdown(text)` inside the custom paste plugin before doing any HTML insertion.
- There is **no second paste handler in the repo**, so the likely failure is not the missing `/m` regex flag and not an obvious competing app-level handler.
- The remaining likely causes are:
  1. the plugin is not winning the paste event in practice,
  2. the clipboard `text/plain` payload differs from what we expect,
  3. `insertContent` succeeds but the inserted HTML is normalized back to plain text by schema/parsing behavior.

## Plan
1. **Add targeted paste diagnostics**
   - Log clipboard types, presence/length of `text/plain` and `text/html`, markdown detection result, and whether the markdown branch actually runs.
   - Log the first safe preview slice of the plain text so we can confirm the clipboard content from `.md` files matches expectations.

2. **Harden markdown precedence**
   - Refactor `handlePaste` so markdown detection is the very first text-path decision after image handling.
   - If structural markdown is detected, explicitly ignore any `text/html` clipboard payload and force the markdown conversion path.
   - Keep sanitization exactly as-is.

3. **Add a second fallback insertion path**
   - If `insertContent(converted)` does not result in structured nodes, fall back to a more explicit insertion approach supported by the editor API so markdown content cannot silently drop to raw text.
   - Validate headings, horizontal rules, lists, and emphasis against the current editor schema.

4. **Verify with the real failure shape**
   - Re-test with pasted `.md` file content matching the user’s sample.
   - Confirm in console whether the forced markdown branch fires and whether the document receives block nodes rather than literal `#` / `---` text.

## Technical notes
- Files likely involved:
  - `src/components/requests/WorkspaceEditor.tsx`
  - `src/lib/markdown-paste.ts`
- No backend, auth, schema, storage, or editor content policy changes are planned.
- The goal is to make pasted markdown from copied `.md` file contents reliably enter the markdown conversion path even when the clipboard carries extra formats.