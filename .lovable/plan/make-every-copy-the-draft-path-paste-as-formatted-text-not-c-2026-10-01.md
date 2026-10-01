# Make every "copy the draft" path paste as formatted text, not code

## What I found

- Karen's drafts are stored correctly as formatted text. Nothing in them is saved as raw code, so the problem happens at copy time, not in her draft.
- The app has three ways to copy a draft out: the **Copy** button, **Push to Substack**, and the **Copy draft** button in the "Copy your draft" pop-up. All three build the clipboard content by hand in code.
- What worked for Karen (select all on the page, then copy) uses the browser's own copy, which every editor, Substack included, understands.
- The hand-built copy sends a bare piece of formatted text with no page wrapper. Some browsers (Safari especially) and Substack's editor can read that as plain text and show the tags. The pop-up also has a "Show markup instead" toggle that shows and copies raw code. If someone lands there, it looks exactly like what Karen described.
- I can't see which browser Karen used, or her copy history. We don't log those clicks, so the exact trigger isn't confirmed.

## Changes

1. **Copy the same way Karen's manual method does.** All three copy buttons place the draft, already formatted, in a hidden spot on the page, select it, and copy it with the browser's own copy. This is the same thing "select all + copy" does. The current method stays only as a backup if that fails.
2. **Wrap the copied content as a full page** when the backup method is used, so Substack reads it as formatted text.
3. **Remove "Show markup instead"** from the pop-up. Nobody needs raw code to paste into Substack.
4. **Track which copy method worked** (browser copy vs backup vs failed) on each click, so next time we can see what happened instead of guessing.
5. **Check it for real:** in a test browser, run each of the three buttons, read the clipboard back, and confirm it holds formatted text (headings, bold, links, images, tables) and no visible tags.

## Technical notes

- `src/lib/clipboard.ts`: add `copyHtmlViaSelection(html)`: off-screen `contenteditable` div, `innerHTML = sanitize(html)`, select range, `document.execCommand("copy")`, remove node, return boolean. `writeDraftToClipboard` tries it first, then falls back to `ClipboardItem` with the HTML wrapped in `<html><head><meta charset="utf-8"></head><body>…</body></html>`. Result returned as `"selection" | "async" | "plain" | false`.
- `SharedWorkspace.tsx`: `handleCopy`, `handlePushToSubstack`, `handleCopyFallback` all use the new helper; drop `showFallbackMarkup` state, toggle and Textarea. Add `method` to `draft_copied` / `push_to_substack_success` events, plus a `draft_copy_failed` event.
- Tests in `src/lib/__tests__/clipboard.test.ts` for selection path, fallback order, and document wrapper. Playwright check with clipboard permissions granted, reading `text/html` back.
- No database changes.
