# Fix Combined PDF Export (Replace pdfmake with Native Print)

## Why it's failing

`pdfmake` builds the whole document **synchronously on the main thread**, with no chunking hooks. For a multi-chapter book this regularly:

- Stalls inside `createPdf(...).getBlob()` (the line that's frozen on "Rendering PDF…"),
- Bloats the JS bundle by ~1 MB (fonts VFS),
- Has known VFS-loading edge cases under Vite that swallow errors silently.

The ZIP/DOCX paths work because `docx` + `JSZip` chunk naturally — pdfmake doesn't. No amount of `requestAnimationFrame` yielding fixes a single blocking C-style call.

## The fix: native browser print-to-PDF

Replace `pdfmake` with a popup-window print flow. The browser is already the best HTML→PDF renderer on the machine, it streams natively, handles any length, and supports user-side options (page size, margins, "Save as PDF").

### How it works

1. Build a self-contained HTML string from the same chapters we already pass to the combined DOCX path:
   - `<style>` block with print-tuned CSS (Letter page, 1" margins, `page-break-before: always` on chapter `<h1>`, serif/sans pair matching brand, table borders, image max-width).
   - Title page `<section>` (project title, date).
   - Auto-generated TOC list.
   - Each chapter wrapped in `<section class="chapter">` with `<h1>` + sanitized `content_html` (already DOMPurified at save time, safe to inject).
2. Open a popup via `window.open("", "_blank", "width=900,height=1100")`, write the HTML, wait for `onload` + images via `Promise.all(img.decode())`, then call `popup.focus(); popup.print();`.
3. The browser shows its native print dialog where the user chooses **Save as PDF**. Popup closes itself after print/cancel via `onafterprint`.
4. Toast in the originating tab: *"Print dialog opened — choose 'Save as PDF' to download your book."*

### What changes

- **Remove** `src/lib/html-to-pdf.ts` (and the `pdfmake` + `pdfmake/build/vfs_fonts` imports). Drop `pdfmake` from `package.json`.
- **New** `src/lib/book-export-pdf.ts` — builds the combined HTML and orchestrates the popup print.
- **Update** `src/lib/book-export.ts` — the `format === "pdf"` branch calls the new helper instead of `chaptersToCombinedPdfBlob`. No yielding needed; the work is delegated to the browser's print pipeline.
- **Update** `src/components/projects/ExportBookDialog.tsx` — when PDF is selected, the progress copy becomes *"Opening print dialog…"* and the dialog closes immediately after the popup is launched (no fake progress bar for the PDF case).
- **Update** `src/lib/html-to-docx.ts` — remove the now-orphaned `ChapterProgressFn` re-export consumer if needed (keep the type — it's still used by the combined DOCX path).

### Popup blocker safety net

If `window.open` returns `null` (popup blocked), surface a clear toast: *"Allow popups for DraftKit to export PDFs, or use the Combined Word document option."* — and re-enable the export button.

### Why not keep pdfmake in a Web Worker?

- Worker setup with pdfmake under Vite requires custom Rollup config, VFS shipping, and a second copy of fonts — fragile and 1 MB heavier.
- Native print is zero bytes added, faster, and produces PDFs that match what the user sees if they print.
- Trade-off: the user clicks "Save as PDF" once in the browser dialog. Acceptable for a Project-tier power-user feature, and arguably **more** premium (they choose paper size, can preview).

## Out of scope

- Server-side PDF rendering (Puppeteer edge function) — heavy, slower, costs egress, and the native path solves the problem.
- Per-chapter PDF export — ZIP-of-DOCX already covers individual editing; PDFs per chapter can be added later if requested.
- Changing the ZIP-DOCX or Combined-DOCX paths — they work.

## Files touched

- `src/lib/book-export.ts` (rewire PDF branch)
- `src/lib/book-export-pdf.ts` (new)
- `src/components/projects/ExportBookDialog.tsx` (PDF copy + early close)
- `src/lib/html-to-pdf.ts` (delete)
- `package.json` (drop `pdfmake`)
