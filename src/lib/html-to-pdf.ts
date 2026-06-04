/**
 * HTML → pdfmake content array. Used by the combined-book PDF export.
 * Tables and inline formatting are preserved.
 */
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

// pdfmake VFS bootstrap — works across CJS/ESM bundlers.
type PdfMakeWithVfs = typeof pdfMake & { vfs?: unknown };
type PdfFontsModule = { pdfMake?: { vfs?: unknown }; vfs?: unknown };
const pm = pdfMake as PdfMakeWithVfs;
const fontsModule = pdfFonts as unknown as PdfFontsModule;
pm.vfs = fontsModule.pdfMake?.vfs ?? fontsModule.vfs ?? pm.vfs;

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  decoration?: "underline" | "lineThrough";
}

function inlineFromTag(t: string): InlineStyle {
  switch (t) {
    case "strong":
    case "b":
      return { bold: true };
    case "em":
    case "i":
      return { italics: true };
    case "u":
      return { decoration: "underline" };
    case "s":
    case "strike":
    case "del":
      return { decoration: "lineThrough" };
    default:
      return {};
  }
}

type InlineText = { text: string } & InlineStyle & { link?: string };

function collectInline(node: Node, style: InlineStyle = {}): InlineText[] {
  const out: InlineText[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/\s+/g, " ");
      if (text) out.push({ text, ...style });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const t = el.tagName.toLowerCase();
    if (t === "br") {
      out.push({ text: "\n" });
      return;
    }
    if (t === "a") {
      const href = el.getAttribute("href") ?? "";
      const inner = collectInline(el, { ...style, decoration: "underline" });
      inner.forEach((i) => out.push({ ...i, link: href || undefined }));
      return;
    }
    const merged = { ...style, ...inlineFromTag(t) };
    out.push(...collectInline(el, merged));
  });
  return out;
}

function inlineToText(items: InlineText[]): Content {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return { text: items };
}

function nodeBlocks(el: Element): Content[] {
  const t = el.tagName.toLowerCase();
  switch (t) {
    case "h1":
      return [{ text: el.textContent ?? "", style: "h1", margin: [0, 12, 0, 6] }];
    case "h2":
      return [{ text: el.textContent ?? "", style: "h2", margin: [0, 10, 0, 4] }];
    case "h3":
      return [{ text: el.textContent ?? "", style: "h3", margin: [0, 8, 0, 4] }];
    case "h4":
    case "h5":
    case "h6":
      return [{ text: el.textContent ?? "", style: "h4", margin: [0, 6, 0, 4] }];
    case "p": {
      const runs = collectInline(el);
      if (runs.length === 0) return [];
      return [{ ...((inlineToText(runs) as object) || {}), margin: [0, 0, 0, 6] } as Content];
    }
    case "ul":
    case "ol": {
      const items: Content[] = [];
      Array.from(el.children).forEach((li) => {
        if (li.tagName.toLowerCase() !== "li") return;
        items.push(inlineToText(collectInline(li)));
      });
      return [t === "ol" ? { ol: items, margin: [0, 0, 0, 6] } : { ul: items, margin: [0, 0, 0, 6] }];
    }
    case "blockquote":
      return [
        {
          text: el.textContent ?? "",
          italics: true,
          color: "#475569",
          margin: [16, 4, 0, 8],
        },
      ];
    case "hr":
      return [
        {
          canvas: [
            { type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: "#CBD5E1" },
          ],
          margin: [0, 6, 0, 6],
        },
      ];
    case "table": {
      const allRows: Element[] = [];
      el.querySelectorAll(
        ":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr",
      ).forEach((tr) => allRows.push(tr as Element));
      if (allRows.length === 0) return [];
      const colCount = Math.max(
        ...allRows.map((tr) =>
          Array.from(tr.children).filter((c) => ["td", "th"].includes(c.tagName.toLowerCase()))
            .length,
        ),
      );
      const body: Content[][] = allRows.map((tr) => {
        const cells = Array.from(tr.children).filter((c) =>
          ["td", "th"].includes(c.tagName.toLowerCase()),
        );
        const row: Content[] = cells.map((cell) => {
          const inner = inlineToText(collectInline(cell));
          if (cell.tagName.toLowerCase() === "th") {
            return { text: cell.textContent ?? "", bold: true, fillColor: "#F1F5F9" };
          }
          return inner;
        });
        while (row.length < colCount) row.push("");
        return row;
      });
      return [
        {
          table: { headerRows: 1, widths: Array.from({ length: colCount }, () => "*"), body },
          layout: {
            hLineColor: () => "#CBD5E1",
            vLineColor: () => "#CBD5E1",
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
          margin: [0, 6, 0, 10],
        },
      ];
    }
    case "pre":
      return [
        {
          text: el.textContent ?? "",
          font: undefined,
          preserveLeadingSpaces: true,
          margin: [0, 4, 0, 8],
          color: "#0F172A",
        },
      ];
    case "div":
    case "section":
    case "article":
      return Array.from(el.children).flatMap((c) => nodeBlocks(c));
    default: {
      const runs = collectInline(el);
      return runs.length ? [inlineToText(runs)] : [];
    }
  }
}

export function htmlToPdfContent(html: string): Content[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html ?? "", "text/html");
  const out: Content[] = [];
  Array.from(doc.body.children).forEach((el) => out.push(...nodeBlocks(el)));
  return out;
}

export interface BookChapterForPdf {
  title: string;
  html: string;
}

export async function chaptersToCombinedPdfBlob(
  projectTitle: string,
  chapters: BookChapterForPdf[],
): Promise<Blob> {
  const content: Content[] = [];
  content.push(
    {
      text: projectTitle,
      style: "title",
      alignment: "center",
      margin: [0, 200, 0, 16],
    },
    {
      text: new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      alignment: "center",
      italics: true,
      color: "#64748B",
      pageBreak: "after",
    },
  );

  content.push({ text: "Contents", style: "h1", margin: [0, 0, 0, 12] });
  chapters.forEach((c, i) => {
    content.push({ text: `${i + 1}. ${c.title}`, margin: [0, 0, 0, 4] });
  });
  content.push({ text: "", pageBreak: "after" });

  chapters.forEach((c, i) => {
    content.push({ text: c.title, style: "h1", margin: [0, 0, 0, 10] });
    content.push(...htmlToPdfContent(c.html));
    if (i < chapters.length - 1) {
      content.push({ text: "", pageBreak: "after" });
    }
  });

  const docDef: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [60, 60, 60, 60],
    info: { title: projectTitle },
    content,
    styles: {
      title: { fontSize: 28, bold: true },
      h1: { fontSize: 20, bold: true },
      h2: { fontSize: 16, bold: true },
      h3: { fontSize: 14, bold: true },
      h4: { fontSize: 12, bold: true },
    },
    defaultStyle: { fontSize: 11, lineHeight: 1.35 },
  };

  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBlob((blob: Blob) => resolve(blob));
    } catch (err) {
      reject(err);
    }
  });
}
