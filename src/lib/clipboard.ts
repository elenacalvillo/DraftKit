/**
 * Shared clipboard helpers used by the workspace toolbar (Copy + Push to
 * Substack). The original navigator.clipboard.write() pattern lived inline
 * inside SharedWorkspace's Copy handler — this file extracts it so the same
 * tested logic can be reused by other "export to clipboard" surfaces (e.g.
 * Push to Substack) without rewriting it.
 *
 * The helpers are intentionally browser-only: they read from `navigator`,
 * `ClipboardItem`, `Blob`, and DOMParser. Tests use jsdom to exercise them.
 */

/**
 * Strip DraftKit-internal annotation attributes from an HTML string.
 *
 * `data-comment` and `data-author` are added by our Tiptap sticky-comment
 * extension to attach inline review notes to a draft. They are meaningful
 * inside the workspace but are pure noise (and would render as junk attrs)
 * once the draft leaves DraftKit — e.g. when pasted into Substack. We strip
 * them at export time rather than refusing to store them so the in-app
 * collaboration UX is unchanged.
 *
 * Implemented as a regex over the string rather than a DOM round-trip so the
 * helper is safe to call in non-DOM environments (and avoids re-serialising
 * the user's draft, which can subtly mutate whitespace / quoting).
 */
export function stripDraftKitInternalAttrs(html: string): string {
  if (!html) return "";
  // Matches both single- and double-quoted values, with optional surrounding
  // whitespace before the attribute (so we can collapse the leading space
  // along with the attribute itself).
  return html
    .replace(/\s+data-comment\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+data-comment\s*=\s*'[^']*'/gi, "")
    .replace(/\s+data-author\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+data-author\s*=\s*'[^']*'/gi, "");
}

/**
 * Convert an HTML string to a plaintext approximation suitable for the
 * `text/plain` clipboard slot. We deliberately keep this tiny — the Substack
 * editor (and most rich-text targets) will use the `text/html` payload, so
 * this fallback only matters for plain editors / search fields.
 */
export function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    // Server / non-DOM context — strip tags with a regex as a last resort.
    return html.replace(/<[^>]+>/g, "");
  }
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || (tmp as HTMLDivElement).innerText || "";
}

/**
 * True when the browser exposes the rich-clipboard API we need to write a
 * dual-format (text/html + text/plain) ClipboardItem. When this is false
 * (non-secure context, older Safari, certain WebViews) callers must fall
 * back to a manual-copy modal — silently degrading would leave the user
 * thinking the click did nothing.
 */
export function isRichClipboardAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined" &&
    typeof Blob !== "undefined"
  );
}

/**
 * Write an HTML draft to the clipboard, preferring the rich
 * `text/html`+`text/plain` ClipboardItem path and falling back to plain
 * text. Returns `true` on a confirmed write, `false` if the browser doesn't
 * support the API at all (caller should show the manual-copy fallback).
 *
 * Note: any thrown error from the underlying API (e.g. permission denied)
 * is re-thrown so the caller can decide whether to toast the failure or
 * open a fallback UI.
 */
export async function writeDraftToClipboard(html: string): Promise<boolean> {
  const plain = htmlToPlainText(html);

  if (isRichClipboardAvailable()) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return true;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plain);
    return true;
  }

  return false;
}
