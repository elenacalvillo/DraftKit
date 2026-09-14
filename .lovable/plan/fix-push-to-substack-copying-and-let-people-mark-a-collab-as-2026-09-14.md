# Fix Push to Substack copying, and let people mark a collab as published anytime

Two separate things Karen hit. Both are real.

## 1. Push to Substack lands in Substack empty

What the code does today: on click it opens the Substack tab first, then asks the browser to copy the draft. Opening a new tab takes focus away from DraftKit, and browsers increasingly refuse a copy while the page is unfocused. That is the most likely reason it started failing recently, on the same browser as always. It is a strong suspicion, not confirmed, so step one is to reproduce it in the sandbox before changing behaviour.

The second half is confirmed by reading the code: the "your browser blocked it" dialog shows the draft's raw HTML markup in a plain text box. Pasting markup into Substack cannot produce a formatted post, which is exactly what she described. Selecting all in the draft and copying works because that carries real formatting.

Fix:
- Copy first, then open the Substack tab. If the tab gets blocked, keep the existing "Open Substack" toast.
- If the copy is refused, retry once after bringing focus back to DraftKit.
- Replace the raw-markup dialog with a formatted preview of the draft plus a "Copy draft" button, so Select-all/copy carries formatting. Keep a "show markup" toggle for anyone who wants it.
- Message says what to do next instead of blaming the browser.

## 2. No way to say "this was published"

Confirmed: marking a collab published only exists inside the celebration banner that appears on or after the collab's target date, and that banner can be permanently dismissed per browser. Hollie's collab (target 7 August, still "approved") shows nothing because the banner was dismissed or already answered, so the status and the stats tracking are stuck.

Fix:
- Add a permanent "Mark as published" action in the workspace actions menu for the host, visible on any approved collab regardless of date.
- It opens the same short form: your post link, guest's post link (optional). Saving flips the status, notifies the guest, and kicks off engagement tracking, exactly as the banner does today.
- Once published, the same menu spot shows "Published" and lets the host edit the post links.
- Keep the existing capacity check so nothing about paid limits changes.

## Reply to Karen

Her collab with Hollie is dated 7 August and still sits as approved, so no stats were collected. After this ships she can mark it published from the workspace menu and tracking starts from that point.

## Technical notes

- `src/components/requests/SharedWorkspace.tsx`: reorder clipboard write before `window.open`, add one focus-then-retry, replace the fallback `Textarea` with a sanitised rendered preview plus a copy button using `writeDraftToClipboard`.
- `src/pages/Workspace.tsx`: extract the existing publish flow (`handlePublishAnswer` / `handlePublishWithUrls`) into a dialog reachable from the workspace action menu; keep `canHostMore` gating and the `send-collab-email` + `fetch-collab-metrics` calls unchanged.
- No database or edge function changes.
- Reproduce and verify the Substack copy path with Playwright against the local preview before and after the change.
