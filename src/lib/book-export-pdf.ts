/**
 * Combined-book PDF export via the browser's native print pipeline.
 *
 * Why: pdfmake runs synchronously on the main thread and silently stalls
 * on long books inside an iframe. The browser's own print-to-PDF is
 * streaming, handles any length, supports user-side page options, and
 * adds zero bundle weight.
 */

export interface BookChapterForPdf {
  title: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPrintableHtml(projectTitle: string, chapters: BookChapterForPdf[]): string {
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const toc = chapters
    .map(
      (c, i) =>
        `<li><span class="toc-num">${i + 1}.</span> <span class="toc-title">${escapeHtml(c.title)}</span></li>`,
    )
    .join("");

  const body = chapters
    .map(
      (c, i) => `
      <section class="chapter${i === 0 ? " first" : ""}">
        <h1 class="chapter-title">${escapeHtml(c.title)}</h1>
        <div class="chapter-body">${c.html ?? ""}</div>
      </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(projectTitle)}</title>
<style>
  @page { size: Letter; margin: 1in; }
  * { box-sizing: border-box; }
  html, body {
    font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #111;
    margin: 0;
    padding: 0;
  }
  h1, h2, h3, h4 { font-weight: 700; line-height: 1.25; margin: 0 0 0.5em; }
  h1 { font-size: 22pt; }
  h2 { font-size: 16pt; margin-top: 1.2em; }
  h3 { font-size: 13pt; margin-top: 1em; }
  p { margin: 0 0 0.8em; orphans: 3; widows: 3; }
  a { color: #1e40af; text-decoration: underline; }
  ul, ol { margin: 0 0 0.8em 1.2em; padding: 0; }
  li { margin-bottom: 0.25em; }
  blockquote {
    margin: 0.8em 0;
    padding: 0.2em 0 0.2em 1em;
    border-left: 3px solid #cbd5e1;
    color: #475569;
    font-style: italic;
  }
  hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1.2em 0; }
  img { max-width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; margin: 0.8em 0; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: top; }
  th { background: #f1f5f9; text-align: left; font-weight: 600; }
  pre, code { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 10pt; }
  pre { background: #f8fafc; padding: 10px; border-radius: 4px; overflow-x: auto; }

  .title-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    page-break-after: always;
  }
  .title-page h1 { font-size: 36pt; margin-bottom: 0.4em; }
  .title-page .date { color: #64748b; font-style: italic; font-size: 12pt; }

  .toc { page-break-after: always; }
  .toc h2 { font-size: 20pt; margin-bottom: 1em; }
  .toc ol { list-style: none; margin: 0; padding: 0; }
  .toc li { margin-bottom: 0.5em; font-size: 12pt; }
  .toc .toc-num { color: #64748b; margin-right: 0.5em; }

  .chapter { page-break-before: always; }
  .chapter.first { page-break-before: always; }
  .chapter-title { font-size: 24pt; margin-bottom: 1em; padding-bottom: 0.3em; border-bottom: 2px solid #111; }

  @media print {
    .no-print { display: none !important; }
  }
  .print-hint {
    position: fixed;
    top: 12px; left: 50%; transform: translateX(-50%);
    background: #111; color: #fff; padding: 10px 16px; border-radius: 8px;
    font-size: 13px; z-index: 999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .print-hint button {
    margin-left: 12px; background: #fff; color: #111; border: 0;
    padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: 600;
  }
</style>
</head>
<body>
  <div class="no-print print-hint">
    Choose <strong>Save as PDF</strong> in the print dialog to download your book.
    <button onclick="window.print()">Open dialog</button>
  </div>

  <section class="title-page">
    <h1>${escapeHtml(projectTitle)}</h1>
    <div class="date">${escapeHtml(date)}</div>
  </section>

  <section class="toc">
    <h2>Contents</h2>
    <ol>${toc}</ol>
  </section>

  ${body}

  <script>
    (function () {
      try { window.opener = null; } catch (e) { /* noop */ }
      function ready() {
        // Wait for images to settle before printing.
        var imgs = Array.prototype.slice.call(document.images);
        var pending = imgs.map(function (img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function (res) {
            img.addEventListener("load", res, { once: true });
            img.addEventListener("error", res, { once: true });
          });
        });
        Promise.all(pending).then(function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 300);
        });
      }
      if (document.readyState === "complete") ready();
      else window.addEventListener("load", ready);
      window.addEventListener("afterprint", function () {
        setTimeout(function () { window.close(); }, 200);
      });
    })();
  </script>
</body>
</html>`;
}

export interface PrintableBookOptions {
  projectTitle: string;
  chapters: BookChapterForPdf[];
}

/**
 * Opens a new browser window containing the assembled book and triggers
 * the native print dialog. Returns true on success, false if the popup
 * was blocked.
 */
export function openPrintableBook({ projectTitle, chapters }: PrintableBookOptions): boolean {
  const popup = window.open("", "_blank", "width=900,height=1100");
  if (!popup) return false;
  const html = buildPrintableHtml(projectTitle, chapters);
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
}
