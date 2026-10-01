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
      "text/html": new Blob([wrapHtmlDocument(html)], { type: "text/html" }),
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

/** Full HTML document wrapper so paste targets parse the payload as rich text. */
export function wrapHtmlDocument(html: string): string {
  if (/^\s*<html[\s>]/i.test(html)) return html;
  return `<html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}

/**
 * Synchronous copy via execCommand("copy") with a copy-event handler that
 * sets text/html (full document) and text/plain directly. Same native copy
 * path as Cmd+C, without the app's computed styles leaking into the paste.
 * Must run inside the click. Caller sanitizes html.
 */
export function copyHtmlViaSelection(html: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  let handled = false;
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    e.clipboardData.setData("text/html", wrapHtmlDocument(html));
    e.clipboardData.setData("text/plain", htmlToPlainText(html));
    e.preventDefault();
    handled = true;
  };
  document.addEventListener("copy", onCopy, true);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    document.removeEventListener("copy", onCopy, true);
  }
  return ok && handled;
}

export type CopyMethod = "selection" | "async" | false;

/** Preferred export copy: selection copy first, async clipboard as backup. */
export async function copyDraft(html: string): Promise<CopyMethod> {
  if (copyHtmlViaSelection(html)) return "selection";
  try {
    if (await writeDraftToClipboard(html)) return "async";
  } catch {
    /* reported as failure */
  }
  return false;
}

/**
 * Wrap each bare `<img>` in its own `<figure>` for export so rich-text
 * targets (Substack) treat it as a single image block. Only `src` and `alt`
 * survive. The stored draft is never modified.
 */
export function wrapImagesForExport(html: string): string {
  if (!html || typeof DOMParser === "undefined" || !/<img/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.body.querySelectorAll("img").forEach((img) => {
    const clean = doc.createElement("img");
    const src = img.getAttribute("src");
    if (src) clean.setAttribute("src", src);
    clean.setAttribute("alt", img.getAttribute("alt") ?? "");
    const parent = img.parentElement;
    if (parent && parent.tagName === "FIGURE") {
      img.replaceWith(clean);
      return;
    }
    const figure = doc.createElement("figure");
    figure.appendChild(clean);
    // Lift out of a paragraph that holds only this image.
    if (parent && parent.tagName === "P" && parent.childNodes.length === 1) {
      parent.replaceWith(figure);
    } else {
      img.replaceWith(figure);
    }
  });
  return doc.body.innerHTML;
}
