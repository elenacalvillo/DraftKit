# Book Metadata + Kindle-ready ePub covers

Authors will be able to upload a cover and set publication details on a project, and every ePub export will ship with the cover baked into the file metadata so Send-to-Kindle and Apple Books render the thumbnail. No Calibre, no conversion round-trip.

## What the author sees

1. **Book details panel on the project page** — new "Book details" section (dialog opened from the project header, next to Export):
   - Cover image upload with live thumbnail preview, replace and remove actions.
   - Author name (prefilled from profile), subtitle, description, ISBN, language.
2. **Export dialog** — when a cover exists, the ePub option shows a green indicator: "Cover embedded for Kindle and Apple Books". If no cover, an inline nudge with a link to add one.
3. Cover also becomes the title page image in the combined PDF and Word exports, so all formats stay consistent.

## Data

New columns on `projects` (all nullable, no behaviour change for existing rows):

- `cover_image_path`, `cover_image_mime`, `cover_image_bytes`
- `author_name`, `subtitle`, `book_description`, `isbn`, `language` (default `en`)

Migration includes the required GRANTs; existing owner-scoped RLS on `projects` already covers reads and writes, so no new policies.

## Upload rules

Cover uploads reuse the existing `project-images` bucket and the `{project_id}/...` path scoping, going through the same helper as workspace images so the 1 GB account cap stays enforced atomically:

- Accepted: JPEG, PNG. Max 10 MB (existing limit).
- Stored at `{project_id}/cover/{timestamp}_{name}`.
- Replacing a cover deletes the old object and decrements usage; a failed usage increment destroys the orphan object.

## ePub packaging changes

`src/lib/book-export-epub.ts` gains an optional cover input (raw bytes + mime) and, when present:

- Writes the image to `OEBPS/images/cover.<ext>`.
- Manifest: `<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`.
- Metadata: legacy `<meta name="cover" content="cover-image"/>` for Kindle plus the EPUB 3 `properties` attribute — both are needed for wide reader support.
- Adds `cover.xhtml` (full-bleed image, `epub:type="cover"`) as the first spine item, marked `linear="no"` so it does not double as page 1 text.
- Manifest/spine ids stay stable; `dc:description`, `dc:identifier` (ISBN when set), `dc:language`, and subtitle metadata are written from the book details.

`src/lib/book-export.ts` fetches the project row, downloads the cover from storage as an `ArrayBuffer` (signed URL, same as image display), and passes it into the epub, PDF and docx builders. Author falls back to `author_name`, then the creator profile name, then "Unknown Author".

## Technical notes

- Cover bytes are fetched once per export and reused; a failed cover fetch degrades gracefully to a cover-less export with a toast warning rather than failing the whole compile.
- `mimetype` stays the first, uncompressed zip entry; the cover image is stored with DEFLATE level 0 to avoid re-compressing JPEGs.
- Files touched: `src/lib/book-export-epub.ts`, `src/lib/book-export.ts`, `src/lib/book-export-pdf.ts`, `src/lib/html-to-docx.ts`, `src/components/projects/ExportBookDialog.tsx`, new `src/components/projects/BookDetailsDialog.tsx`, new `src/lib/project-cover.ts`, `src/hooks/useProjects.ts`, `src/pages/ProjectDetail.tsx`, plus one migration.
- Unit tests for the OPF/manifest output (cover tags present with a cover, absent without) and for cover path scoping.
