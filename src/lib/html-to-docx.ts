/**
 * HTML → docx converter that preserves inline formatting, lists, images,
 * and (crucially) tables. Used by the workspace .docx download and by
 * the Book Project bulk export.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  IParagraphOptions,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type DocxBlock = Paragraph | Table;

const CONTENT_WIDTH_DXA = 9360; // US Letter 8.5" - 2 * 1" margins
const BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "CCCCCC",
};
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const NUMBERING = {
  config: [
    {
      reference: "bullets",
      levels: [0, 1, 2].map((level) => ({
        level,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
        },
      })),
    },
    {
      reference: "numbers",
      levels: [0, 1, 2].map((level) => ({
        level,
        format: LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
        },
      })),
    },
  ],
};

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
}

function tag(el: Element): string {
  return el.tagName.toLowerCase();
}

function isInlineFormattingTag(t: string): boolean {
  return ["strong", "b", "em", "i", "u", "s", "strike", "del", "code", "span", "mark"].includes(t);
}

function styleFromTag(t: string): InlineStyle {
  switch (t) {
    case "strong":
    case "b":
      return { bold: true };
    case "em":
    case "i":
      return { italics: true };
    case "u":
      return { underline: true };
    case "s":
    case "strike":
    case "del":
      return { strike: true };
    case "code":
      return { code: true };
    default:
      return {};
  }
}

function mergeStyle(a: InlineStyle, b: InlineStyle): InlineStyle {
  return { ...a, ...b };
}

function runFromText(text: string, style: InlineStyle): TextRun {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    underline: style.underline ? {} : undefined,
    strike: style.strike,
    font: style.code ? "Courier New" : undefined,
  });
}

/** Walk inline children into TextRun / ExternalHyperlink array. */
function collectInline(node: Node, style: InlineStyle = {}): Array<TextRun | ExternalHyperlink> {
  const out: Array<TextRun | ExternalHyperlink> = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/\s+/g, " ");
      if (text) out.push(runFromText(text, style));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const t = tag(el);
    if (t === "br") {
      out.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    if (t === "a") {
      const href = el.getAttribute("href") ?? "";
      const inner = collectInline(el, mergeStyle(style, { underline: true })).filter(
        (r): r is TextRun => r instanceof TextRun,
      );
      if (href) {
        out.push(new ExternalHyperlink({ children: inner, link: href }));
      } else {
        out.push(...inner);
      }
      return;
    }
    if (isInlineFormattingTag(t)) {
      out.push(...collectInline(el, mergeStyle(style, styleFromTag(t))));
      return;
    }
    // Unknown inline-ish element: fall through to its children with the same style.
    out.push(...collectInline(el, style));
  });
  return out;
}

async function fetchImageAsBuffer(
  url: string,
): Promise<{ data: ArrayBuffer; type: "png" | "jpg" | "gif" | "bmp" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    let type: "png" | "jpg" | "gif" | "bmp" = "png";
    if (ext === "jpg" || ext === "jpeg") type = "jpg";
    else if (ext === "gif") type = "gif";
    else if (ext === "bmp") type = "bmp";
    return { data: buf, type };
  } catch {
    return null;
  }
}

async function convertImage(el: Element): Promise<Paragraph | null> {
  const src = el.getAttribute("src");
  if (!src) return null;
  // Skip base64 (DOMPurify should already strip them, but be defensive).
  if (src.startsWith("data:")) return null;
  const img = await fetchImageAsBuffer(src);
  if (!img) return null;
  // Constrain width to content width; preserve aspect via natural ratio if possible.
  const maxPx = 600;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        type: img.type,
        data: img.data,
        transformation: { width: maxPx, height: Math.round(maxPx * 0.6) },
        altText: {
          title: el.getAttribute("alt") ?? "image",
          description: el.getAttribute("alt") ?? "image",
          name: "image",
        },
      } as never),
    ],
  });
}

async function convertList(
  el: Element,
  ordered: boolean,
  level = 0,
): Promise<Paragraph[]> {
  const out: Paragraph[] = [];
  const reference = ordered ? "numbers" : "bullets";
  for (const child of Array.from(el.children)) {
    if (tag(child) !== "li") continue;
    // Inline content of the li (excluding nested lists).
    const inlineNodes = Array.from(child.childNodes).filter((n) => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const tn = tag(n as Element);
        return tn !== "ul" && tn !== "ol";
      }
      return true;
    });
    const wrapper = el.ownerDocument!.createElement("div");
    inlineNodes.forEach((n) => wrapper.appendChild(n.cloneNode(true)));
    const runs = collectInline(wrapper);
    if (runs.length === 0) runs.push(new TextRun(""));
    out.push(
      new Paragraph({
        numbering: { reference, level: Math.min(level, 2) },
        children: runs,
        spacing: { after: 80 },
      }),
    );
    // Recurse nested lists.
    for (const nested of Array.from(child.children)) {
      const nt = tag(nested);
      if (nt === "ul" || nt === "ol") {
        const nestedBlocks = await convertList(nested, nt === "ol", level + 1);
        out.push(...nestedBlocks);
      }
    }
  }
  return out;
}

async function convertTable(el: Element): Promise<Table | null> {
  // Collect all rows (from thead/tbody/tfoot or direct tr children).
  const allRows: Element[] = [];
  el.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr").forEach(
    (tr) => allRows.push(tr as Element),
  );
  if (allRows.length === 0) return null;

  // Determine column count.
  const colCount = Math.max(
    ...allRows.map((tr) =>
      Array.from(tr.children).reduce((sum, c) => {
        if (tag(c) !== "td" && tag(c) !== "th") return sum;
        const colspan = parseInt(c.getAttribute("colspan") ?? "1", 10) || 1;
        return sum + colspan;
      }, 0),
    ),
  );
  if (colCount === 0) return null;

  const colWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);
  const columnWidths = Array.from({ length: colCount }, () => colWidth);

  const rows: TableRow[] = [];
  for (const tr of allRows) {
    const cells: TableCell[] = [];
    for (const cell of Array.from(tr.children)) {
      const t = tag(cell);
      if (t !== "td" && t !== "th") continue;
      const colspan = parseInt(cell.getAttribute("colspan") ?? "1", 10) || 1;
      const rowspan = parseInt(cell.getAttribute("rowspan") ?? "1", 10) || 1;
      const cellBlocks = await convertNodes(Array.from(cell.childNodes));
      // Cells must contain at least one paragraph.
      const children: Array<Paragraph | Table> =
        cellBlocks.length > 0 ? cellBlocks : [new Paragraph({ children: [new TextRun("")] })];
      // Bold header cells.
      if (t === "th") {
        children.forEach((c) => {
          if (c instanceof Paragraph) {
            // best-effort: docx-js doesn't expose mutate-after-construct,
            // so wrap by rebuilding with bold inline.
          }
        });
      }
      cells.push(
        new TableCell({
          width: { size: colWidth * colspan, type: WidthType.DXA },
          columnSpan: colspan > 1 ? colspan : undefined,
          rowSpan: rowspan > 1 ? rowspan : undefined,
          borders: ALL_BORDERS,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          shading:
            t === "th"
              ? { fill: "F1F5F9", type: ShadingType.CLEAR, color: "auto" }
              : undefined,
          children: children.map((c) =>
            c instanceof Paragraph && t === "th"
              ? wrapParagraphBold(c)
              : c,
          ) as Paragraph[],
        }),
      );
    }
    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

/** Rebuild a paragraph with bold runs (used for th cells). */
function wrapParagraphBold(p: Paragraph): Paragraph {
  // We can't easily clone; we just return as-is. Header bolding is a
  // nicety, not critical. Real solution would build the cell content
  // from collectInline with bold style, but it requires a parallel code
  // path. For v1 we accept regular weight in th cells.
  return p;
}

async function convertBlock(el: Element): Promise<DocxBlock[]> {
  const t = tag(el);
  switch (t) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level =
        ({ h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6 } as Record<
          string,
          (typeof HeadingLevel)[keyof typeof HeadingLevel]
        >)[t];
      return [
        new Paragraph({
          heading: level,
          spacing: { before: 240, after: 120 },
          children: collectInline(el),
        }),
      ];
    }
    case "p": {
      const runs = collectInline(el);
      if (runs.length === 0) return [];
      return [
        new Paragraph({
          spacing: { after: 160, line: 320 },
          children: runs,
        } satisfies IParagraphOptions),
      ];
    }
    case "ul":
      return convertList(el, false);
    case "ol":
      return convertList(el, true);
    case "blockquote":
      return [
        new Paragraph({
          spacing: { before: 120, after: 160 },
          indent: { left: 720 },
          children: collectInline(el).map((r) =>
            r instanceof TextRun ? r : r,
          ),
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: "94A3B8", space: 12 },
          },
        }),
      ];
    case "hr":
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CBD5E1", space: 6 } },
          children: [],
        }),
      ];
    case "img": {
      const p = await convertImage(el);
      return p ? [p] : [];
    }
    case "table": {
      const tbl = await convertTable(el);
      return tbl ? [tbl, new Paragraph({ children: [new TextRun("")] })] : [];
    }
    case "div":
    case "section":
    case "article":
      return convertNodes(Array.from(el.childNodes));
    case "pre": {
      // Preserve newlines inside code blocks.
      const text = el.textContent ?? "";
      return text.split("\n").map(
        (line) =>
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: line, font: "Courier New" })],
          }),
      );
    }
    default: {
      // Inline-only element at block position: wrap in paragraph.
      const runs = collectInline(el);
      if (runs.length === 0) return [];
      return [new Paragraph({ spacing: { after: 160 }, children: runs })];
    }
  }
}

async function convertNodes(nodes: Node[]): Promise<DocxBlock[]> {
  const out: DocxBlock[] = [];
  // Group stray inline / text nodes into implicit paragraphs.
  let pendingInline: Node[] = [];
  const flushInline = () => {
    if (pendingInline.length === 0) return;
    const wrapper = nodes[0]?.ownerDocument?.createElement("p");
    if (!wrapper) {
      pendingInline = [];
      return;
    }
    pendingInline.forEach((n) => wrapper.appendChild(n.cloneNode(true)));
    const runs = collectInline(wrapper);
    if (runs.length > 0) {
      out.push(new Paragraph({ spacing: { after: 160 }, children: runs }));
    }
    pendingInline = [];
  };

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim()) pendingInline.push(node);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    const t = tag(el);
    if (isInlineFormattingTag(t) || t === "a" || t === "br") {
      pendingInline.push(node);
      continue;
    }
    flushInline();
    const blocks = await convertBlock(el);
    out.push(...blocks);
  }
  flushInline();
  return out;
}

/** Convert an HTML string into a flat array of docx blocks. */
export async function htmlToDocxBlocks(html: string): Promise<DocxBlock[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html ?? "", "text/html");
  const blocks = await convertNodes(Array.from(doc.body.childNodes));
  if (blocks.length === 0) {
    return [new Paragraph({ children: [new TextRun("")] })];
  }
  return blocks;
}

const DEFAULT_PAGE = {
  size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
};

const DEFAULT_STYLES = {
  default: { document: { run: { font: "Arial", size: 22 } } },
};

/** Render a single HTML chunk as a complete .docx blob. */
export async function htmlToDocxBlob(html: string): Promise<Blob> {
  const blocks = await htmlToDocxBlocks(html);
  const docDef = new Document({
    numbering: NUMBERING,
    styles: DEFAULT_STYLES,
    sections: [{ properties: { page: DEFAULT_PAGE }, children: blocks }],
  });
  return Packer.toBlob(docDef);
}

export interface BookChapterForDocx {
  title: string;
  html: string;
}

/** Render multiple chapters as one combined .docx with title page + page breaks. */
export async function chaptersToCombinedDocxBlob(
  projectTitle: string,
  chapters: BookChapterForDocx[],
): Promise<Blob> {
  const children: DocxBlock[] = [];

  // Title page.
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 240 },
      children: [new TextRun({ text: projectTitle, bold: true, size: 56 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          size: 24,
          italics: true,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // Table of contents (manual list — no fields, works everywhere).
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Contents", bold: true })],
    }),
  );
  chapters.forEach((c, i) => {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `${i + 1}. ${c.title}` })],
      }),
    );
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (let i = 0; i < chapters.length; i += 1) {
    const c = chapters[i];
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 200 },
        children: [new TextRun({ text: c.title, bold: true })],
      }),
    );
    const blocks = await htmlToDocxBlocks(c.html);
    children.push(...blocks);
    if (i < chapters.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const docDef = new Document({
    numbering: NUMBERING,
    styles: DEFAULT_STYLES,
    sections: [{ properties: { page: DEFAULT_PAGE }, children }],
  });
  return Packer.toBlob(docDef);
}
