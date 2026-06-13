# Add ePub export for book projects

## Why

PDF exports render terribly on Kindle — fixed page size means microscopic text and pan/zoom. ePub is reflowable, so early readers get a native e-reader experience (adjustable fonts, margins, page progress). We already have the chapter assembly pipeline from the PDF/DOCX exports, so this is mostly packaging.

## Approach

Build ePub 3.0 client-side using the existing `JSZip` dependency — no new packages. An ePub is just a zip with a fixed file layout, and we already produce sanitized chapter HTML.

### 1. `src/lib/book-export-epub.ts` (new)

Helper `buildEpubBlob({ projectTitle, author, chapters })` that returns a `Blob` with mime `application/epub+zip`.

Internal layout written into the zip:

```text
mimetype                        (stored, no compression — first entry, required)
META-INF/container.xml          (points to OEBPS/content.opf)
OEBPS/content.opf               (package: metadata, manifest, spine)
OEBPS/toc.ncx                   (EPUB2 nav fallback)
OEBPS/nav.xhtml                 (EPUB3 nav doc)
OEBPS/styles/book.css           (reflowable typography)
OEBPS/title.xhtml               (cover/title page)
OEBPS/chap-001.xhtml … chap-NNN.xhtml
```

Per-chapter XHTML wraps the existing sanitized `shared_content` HTML in a valid `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml">…</html>` shell with a `<h1>` chapter title and a link to `book.css`. Reuse `sanitize()` from `book-export.ts` for filenames; reuse `escapeHtml` pattern from `book-export-pdf.ts` for attribute/title escaping.

CSS: serif body, generous line-height, `h1.chapter-title { page-break-before: always; }`, no fixed widths — let the reader reflow.

UUID for `dc:identifier` via `crypto.randomUUID()`. `dc:language` = `en` (matches existing copy). Author = current creator's display name (lookup via `supabase.from("creators").select("name").eq("id", user.id).single()` inside the orchestrator, fall back to "Unknown Author").

That makes total sense. If you are writing the book in Spanish, setting the metadata tag to `"es"` is exactly what you need so that Kindles load the correct Spanish dictionary, hyphenation rules, and text-to-speech engine for your readers.

Since your platform might have both English and Spanish writers, the cleanest approach is to have Lovable look at the actual content or project configuration, with a smart fallback.

Here is the exact modification to drop into Section 1 of the Lovable prompt before you run it:

Plaintext

```
- `dc:language` detection: Check if the project or chapters contain language settings. If not available, do a quick regex check on the first chapter's content for high-frequency Spanish stop words (like "el", "la", "los", "y") to dynamically set `dc:language` to "es", otherwise default to "en".

```

Alternatively, if you want to keep the code ultra-simple and lightweight without text parsing, just tell Lovable to default it to `"es"` directly for your build:

Plaintext

```
- `dc:language` tag: Set this to "es" (Spanish) to match the manuscript's language so Kindle dictionaries and fonts render correctly.

```

Pick the one that fits your immediate preference, add it to the plan, and tell Lovable to build it. It is going to work flawlessly on your device!

Critical zip detail: `mimetype` must be the **first** file in the archive and stored uncompressed (`{ compression: "STORE" }`). `JSZip.generateAsync({ type: "blob", mimeType: "application/epub+zip" })`.

### 2. `src/lib/book-export.ts`

- Extend `BookExportFormat` type with `"epub"`.
- Add an `if (format === "epub")` branch that fetches the author name, calls `buildEpubBlob`, then `saveAs(blob, \`${base}.epub)`. Emits the same` onProgress` ticks per chapter so the dialog progress bar keeps working.

### 3. `src/components/projects/ExportBookDialog.tsx`

Add a new entry to `FORMATS`:

```text
id: "epub"
title: "ePub (.epub)"
description: "Best for Kindle, Apple Books, and mobile e-readers. Reflowable text that adapts to any screen."
icon: BookOpen   // from lucide-react
```

Place it directly above the PDF option so it reads as the recommended reader-facing format. No other UI changes — selection, progress, and the existing local-compilation reassurance copy all already handle a new format generically.

## Out of scope

- Cover image upload (uses a text-only title page for v1).
- EPUB validation tooling — output is hand-written to spec and tested against Apple Books / Kindle Previewer manually.
- Server-side generation or new dependencies.

## Files

- `src/lib/book-export-epub.ts` — new
- `src/lib/book-export.ts` — add `"epub"` branch
- `src/components/projects/ExportBookDialog.tsx` — add format option