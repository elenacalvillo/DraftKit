import TurndownService from "turndown";

let cached: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (cached) return cached;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });
  // Tables: turndown doesn't handle GFM tables by default.
  td.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const el = node as HTMLTableElement;
      const rows: string[][] = [];
      el.querySelectorAll("tr").forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll("th,td").forEach((c) => {
          cells.push((c.textContent ?? "").trim().replace(/\|/g, "\\|").replace(/\n+/g, " "));
        });
        if (cells.length) rows.push(cells);
      });
      if (rows.length === 0) return "";
      const colCount = Math.max(...rows.map((r) => r.length));
      const pad = (r: string[]) =>
        Array.from({ length: colCount }, (_, i) => r[i] ?? "");
      const lines: string[] = [];
      lines.push(`| ${pad(rows[0]).join(" | ")} |`);
      lines.push(`| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`);
      rows.slice(1).forEach((r) => lines.push(`| ${pad(r).join(" | ")} |`));
      return `\n\n${lines.join("\n")}\n\n`;
    },
  });
  cached = td;
  return td;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return getTurndown().turndown(html);
}
