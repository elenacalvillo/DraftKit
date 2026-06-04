## Problem

Markdown paste handler is bypassed when the clipboard also carries a `text/html` wrapper (which Notion, Notes, chat apps, and most browsers always add). The `!html` guard skips the markdown path, Tiptap parses the wrapper, and `#`, `---`, `**` survive as raw text.

## Fix

1. **`src/lib/markdown-paste.ts`** — add `hasStructuralMarkdown(text)` that matches only strong block-level tokens: ATX headings (`^#{1,6} `), fenced code (` ``` `), thematic break (`^---$`/`^***$`), list markers (`^[-*+] `, `^\d+\. `), blockquote (`^> `), setext underline (`^===+$`). Keep existing `looksLikeMarkdown` as is.

2. **`src/components/requests/WorkspaceEditor.tsx`** — in the paste handler, replace the `!html && text && looksLikeMarkdown(text)` condition with `text && hasStructuralMarkdown(text)`. Trigger regardless of HTML presence. Rich web-page pastes won't match (their text/plain fallbacks contain no `#`/`---`/fence tokens), so they continue to flow through Tiptap's default HTML pipeline.

3. No other changes — image paste, drop, DOMPurify whitelist, schema, save path all untouched.

## Verify

Paste the Prólogo block → headings, `---` rules, italics render. Paste from a Notion/article → unchanged. Paste plain prose → unchanged.
