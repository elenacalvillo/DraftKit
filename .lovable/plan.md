# Book Project Export Suite + Table Export Fix

Two related tracks:
1. New Project-tier feature: bulk export an entire book project in multiple formats.
2. Fix the existing `.docx` export so Tiptap tables (and other formatting) survive intact when opened locally.

---

## Track 1 — Bulk Book Export (Project tier)

### Where it lives
- New "Export book" button on the Project Detail page header (`src/pages/ProjectDetail.tsx`), gated by `hasProjectAccess(creator)`.
- Free / Pro users see the button with a lock + `UpgradePrompt(feature="export")` upsell modal.

### Export dialog
A single dialog with 4 format options (user can pick one per export, but all 4 are always available to Project members):

1. **ZIP of individual chapter `.docx` files** — `01 — Chapter Title.docx`, `02 — …`, etc.
2. **ZIP of individual chapter `.md` files** — same naming convention, HTML → Markdown via `turndown`.
3. **Single combined `.pdf`** — title page (project title + author + date), auto-generated TOC, then each chapter starting on a new page with an `H1` chapter title.
4. **Single combined `.docx`** — same structure as the PDF (title page, TOC field, chapters separated by page breaks).

Chapter ordering: use the existing `chapter_order` column (already sorted ascending in `useProjectChapters`). No reorder UI at export time.

Filename: `{Project Title} — Export ({YYYY-MM-DD}).{ext|zip}`, sanitized.

### Progress + UX
- Dialog shows a progress bar while building (chapter count can be large).
- Generation happens client-side using each chapter's `content_html` already fetched by `useProjectChapters`. No edge function needed.
- After build, file downloads via `file-saver`. Toast on success/error.
- Analytics: `book_export_started` / `book_export_completed` with `{ format, chapter_count, tier }`.

### Libraries
- `docx` (already installed) — `.docx` files.
- `jszip` — zipping per-chapter files (new dep).
- `turndown` — HTML → Markdown (new dep).
- `pdf-lib` or `jspdf` + `html2canvas` is heavy; instead generate PDF by reusing the combined `.docx` path through a lightweight HTML-to-PDF route: render combined HTML in a hidden iframe and use the browser's `window.print()` is unreliable. **Plan: use `pdfmake`** (new dep, ~300KB) which accepts a structured doc model — same content tree we build for `docx`, mapped to pdfmake's format. Single dependency, no server.

### Access gating
- Button disabled + tooltip "Project tier feature" when `!hasProjectAccess`.
- On click while gated → navigate to `/dashboard/subscription?returnTo=…` (consistent with `UpgradePrompt`).
- No backend/RLS changes needed — content is already readable to project members.

---

## Track 2 — Fix Table Rendering in `.docx` Export

Current `exportWorkspaceHtmlToDocx` in `src/lib/export-draft.ts` walks only top-level children and handles `h1/h2/h3/ul/ol/p`. It **completely ignores `<table>`**, so Tiptap tables vanish or get flattened to plain text. It also drops inline formatting (bold, italic, links) because each block becomes a single `TextRun` from `textContent`.

### New HTML → DOCX converter
Replace the ad-hoc walker with a proper recursive converter:

- **Inline runs**: walk child nodes; emit `TextRun` per span, preserving `bold`, `italics`, `underline`, `strike`, `code`, hyperlinks (`ExternalHyperlink`).
- **Block-level handlers**:
  - `h1/h2/h3` → `HeadingLevel.HEADING_1/2/3` with inline runs.
  - `p` → `Paragraph` with inline runs (skip empty).
  - `ul/ol` → numbered config (`bullets` / `numbers` reference) per docx rules — never literal `•` characters. Support nesting via `level`.
  - `blockquote` → indented italic paragraphs.
  - `hr` → empty paragraph with bottom border.
  - `img` → `ImageRun` (fetch from Supabase public URL, base64, supply `type` from extension).
  - `table` → `Table` with `WidthType.DXA`, `columnWidths` summing to 9360 (US Letter content width), each cell sets matching `width`, `margins`, light gray border, `ShadingType.CLEAR` for header row. Walk `tr` → `td/th`; cell children go through the same block converter recursively.
- Set explicit US Letter page size (12240×15840 DXA, 1440 margins) and Arial default font in `Document.styles` so tables render identically in Word / Pages / Google Docs.

### Where it's used
- `SharedWorkspace.tsx` "Download as Word" action — picks up the fix automatically.
- Per-chapter `.docx` in the new ZIP export uses the same converter.
- Combined `.docx` book export uses the same converter, wrapped with a title page + page breaks between chapters.

### Reuse for PDF
The same intermediate node tree (paragraphs / lists / tables / images) is mapped to pdfmake's content array for the combined PDF path — one HTML parser, two renderers.

---

## Technical notes

- New files:
  - `src/lib/html-to-docx.ts` — recursive converter (replaces current logic in `export-draft.ts`).
  - `src/lib/html-to-pdf.ts` — pdfmake mapper.
  - `src/lib/book-export.ts` — orchestrator: fetch chapters, build per-format outputs.
  - `src/components/projects/ExportBookDialog.tsx` — format picker + progress UI.
- Dependencies to add: `jszip`, `turndown`, `pdfmake`.
- `docx` version already in use is compatible.
- No DB migrations, no edge functions, no RLS changes.
- Sanitization untouched — exports read HTML that's already been DOMPurified on save.
- Storage cap unaffected — exports are downloaded client-side, nothing uploaded.

## Out of scope
- Reordering chapters at export time (uses saved `chapter_order`).
- ePub / Kindle formats (can be added later if requested).
- Per-chapter individual download (already covered by ZIP option).
- Watermarked free preview — not requested; Project-tier gate only.

## Open question for next iteration
User will provide a sample workspace HTML / broken `.docx` so we can confirm the new converter handles their exact table shape (merged cells? wide tables?). Plan covers standard Tiptap tables; if her file uses merged cells (`colspan`/`rowspan`) we'll extend the cell handler.
