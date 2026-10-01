# Push to Substack: what's really wrong vs expected

## Findings

**1. The empty Substack post is expected.** Substack doesn't let other apps fill a post directly. The push copies the draft and opens a blank post for you to paste into. Karen's push worked: it logged as a success on Sep 30, and her paste came through. But nothing tells the user ahead of time that the post will open empty, so it looks broken.

**2. The notice that never goes away is a real bug.** After a successful push, the "Draft copied! Switch to the new tab and paste" message is set to stay forever, and it has no close button. It stays until the page reloads. Karen is right.

**3. The duplicate "image not found" box is probably on Substack's side, but we can make it less likely.** I checked Karen's drafts: each image is stored once, with a working public link, so DraftKit doesn't send it twice. When you paste an image from another site, Substack makes its own copy of it, and sometimes it leaves an empty placeholder behind. Our images are also pasted bare instead of inside a paragraph or image block, which Substack handles less cleanly. I can't test inside Substack from here, so this part is a likely cause, not a confirmed one.

## Changes

1. **The notice can be closed.** It gets a close button, closes itself after about 20 seconds, and also closes when you come back to the DraftKit tab.
2. **Clearer wording before and after.** It now reads: "Draft copied. Substack opened a blank post: click into it and press Cmd+V (Ctrl+V)." The same "opens blank, then paste" note is added to the Push button's tooltip.
3. **Cleaner images in the copied draft.** In the copied version only, each image is wrapped in a standard image block, so Substack sees one image per spot. Your saved draft doesn't change.
4. **Tip in the notice:** "If an empty image box appears under a picture, delete it." That way nobody gets confused if Substack still does it.

## Technical notes

- `src/components/requests/SharedWorkspace.tsx` `handlePushToSubstack`: replace `duration: Infinity` with `duration: 20000` and `closeButton: true`, keep the toast id, and on `window` `focus` call `toast.dismiss(id)`. Update the copy and the Push button title.
- `src/lib/clipboard.ts`: add `wrapImagesForExport(html)`, which turns each bare `<img>` into `<figure><img ...></figure>` (DOMParser, allowed-list attrs `src`/`alt` only). It's applied in the push and Copy paths after `stripDraftKitInternalAttrs`. Add unit tests in `src/lib/__tests__/clipboard.test.ts`.
- No database or backend changes.
