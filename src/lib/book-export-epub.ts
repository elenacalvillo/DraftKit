/**
 * Reflowable ePub 3.0 export built client-side with JSZip.
 * Works on Kindle, Apple Books, and other e-readers.
 */
import JSZip from "jszip";

export interface EpubChapter {
  title: string;
  html: string;
}

export interface BuildEpubOptions {
  projectTitle: string;
  author: string;
  chapters: EpubChapter[];
  language?: string;
  onProgress?: (current: number, total: number, label: string) => void;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

/**
 * Lightweight HTML → XHTML normalisation. The Tiptap output is already
 * DOMPurify-sanitised, so we only need to self-close void elements and
 * strip stray script/style nodes that have no place in an ePub.
 */
function htmlToXhtml(html: string): string {
  if (!html) return "";
  const voidTags = ["br", "hr", "img", "input", "meta", "link", "source"];
  let out = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  voidTags.forEach((tag) => {
    const re = new RegExp(`<${tag}\\b([^>]*?)\\s*\\/?>(?!\\s*</${tag}>)`, "gi");
    out = out.replace(re, `<${tag}$1/>`);
  });
  // Drop unknown XML-illegal control chars.
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return out;
}

function chapterXhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <section epub:type="chapter">
    <h1 class="chapter-title">${escapeXml(title)}</h1>
    ${htmlToXhtml(bodyHtml)}
  </section>
</body>
</html>`;
}

function titleXhtml(projectTitle: string, author: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(projectTitle)}</title>
  <link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <section class="title-page">
    <h1 class="book-title">${escapeXml(projectTitle)}</h1>
    <p class="book-author">${escapeXml(author)}</p>
  </section>
</body>
</html>`;
}

function navXhtml(chapters: EpubChapter[]): string {
  const items = chapters
    .map((c, i) => `      <li><a href="chap-${pad(i + 1)}.xhtml">${escapeXml(c.title)}</a></li>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="utf-8"/>
  <title>Contents</title>
  <link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

function tocNcx(projectTitle: string, uuid: string, chapters: EpubChapter[]): string {
  const points = chapters
    .map(
      (c, i) => `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="chap-${pad(i + 1)}.xhtml"/>
    </navPoint>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(uuid)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(projectTitle)}</text></docTitle>
  <navMap>
${points}
  </navMap>
</ncx>`;
}

function contentOpf(
  projectTitle: string,
  author: string,
  language: string,
  uuid: string,
  chapters: EpubChapter[],
): string {
  const manifestItems = chapters
    .map(
      (_c, i) =>
        `    <item id="chap-${pad(i + 1)}" href="chap-${pad(i + 1)}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const spineItems = chapters
    .map((_c, i) => `    <itemref idref="chap-${pad(i + 1)}"/>`)
    .join("\n");
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${escapeXml(uuid)}</dc:identifier>
    <dc:title>${escapeXml(projectTitle)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${escapeXml(language)}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/book.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title"/>
    <itemref idref="nav"/>
${spineItems}
  </spine>
</package>`;
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const BOOK_CSS = `@charset "utf-8";
html, body {
  margin: 0;
  padding: 0;
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
}
p { margin: 0 0 1em; text-indent: 1.2em; orphans: 2; widows: 2; }
p:first-of-type, h1 + p, h2 + p, h3 + p { text-indent: 0; }
h1, h2, h3, h4 { font-family: Helvetica, Arial, sans-serif; line-height: 1.25; margin: 1.4em 0 0.6em; }
h1.chapter-title { page-break-before: always; margin-top: 0; font-size: 1.6em; }
blockquote { margin: 1em 1.2em; font-style: italic; color: #444; }
ul, ol { margin: 0 0 1em 1.4em; padding: 0; }
li { margin-bottom: 0.3em; }
img { max-width: 100%; height: auto; }
a { color: #1e40af; text-decoration: underline; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: top; }
th { background: #f1f5f9; text-align: left; font-weight: 600; }
hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1.4em 0; }
.title-page { text-align: center; padding: 25% 1em 0; }
.title-page .book-title { font-size: 2.2em; margin-bottom: 0.4em; }
.title-page .book-author { font-style: italic; color: #555; }
`;

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function buildEpubBlob(opts: BuildEpubOptions): Promise<Blob> {
  const { projectTitle, author, chapters, language = "en", onProgress } = opts;
  const id = uuid();
  const zip = new JSZip();

  // mimetype MUST be the first entry and stored uncompressed.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);

  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles/book.css", BOOK_CSS);
  oebps.file("title.xhtml", titleXhtml(projectTitle, author));
  oebps.file("nav.xhtml", navXhtml(chapters));
  oebps.file("toc.ncx", tocNcx(projectTitle, id, chapters));
  oebps.file("content.opf", contentOpf(projectTitle, author, language, id, chapters));

  for (let i = 0; i < chapters.length; i += 1) {
    onProgress?.(i, chapters.length, `Packaging chapter ${i + 1} of ${chapters.length}: ${chapters[i].title}`);
    oebps.file(`chap-${pad(i + 1)}.xhtml`, chapterXhtml(chapters[i].title, chapters[i].html));
  }

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
