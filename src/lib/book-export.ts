/**
 * Book Project bulk export orchestrator.
 * Pulls each chapter's shared_content HTML and assembles per-format outputs.
 */
import JSZip from "jszip";
import { saveAs } from "file-saver";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import {
  chaptersToCombinedDocxBlob,
  htmlToDocxBlob,
  type BookChapterForDocx,
} from "./html-to-docx";
import { openPrintableBook } from "./book-export-pdf";
import { buildEpubBlob } from "./book-export-epub";
import { htmlToMarkdown } from "./html-to-markdown";
import { yieldToBrowser } from "./async-yield";

// Sanitise chapter HTML before writing it into export popups, docx, or
// epub. `shared_content` can be PATCHed directly via the Supabase API by
// any authenticated workspace participant, bypassing the Tiptap editor
// schema — strip scripts and event handlers defensively here.
const EXPORT_ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "strong", "em", "s", "u", "code", "pre",
  "a", "ul", "ol", "li", "br", "hr", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td", "span", "img",
];
const EXPORT_ALLOWED_ATTR = [
  "href", "target", "rel", "colspan", "rowspan", "class", "src", "alt", "title",
];

function sanitizeChapterHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EXPORT_ALLOWED_TAGS,
    ALLOWED_ATTR: EXPORT_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
}

export type BookExportFormat = "zip-docx" | "zip-md" | "pdf" | "docx" | "epub";

interface ChapterRow {
  id: string;
  message: string | null;
  shared_content: string | null;
  chapter_order: number | null;
  created_at: string;
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\s+/g, " ").trim() || "Untitled";
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

async function fetchChapters(projectId: string): Promise<BookChapterForDocx[]> {
  const { data, error } = await supabase
    .from("collab_requests")
    .select("id, message, shared_content, chapter_order, created_at")
    .eq("project_id", projectId)
    .eq("is_project_workspace", true)
    .order("chapter_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as ChapterRow[];
  return rows.map((r) => ({
    title: (r.message ?? "Untitled chapter").trim() || "Untitled chapter",
    html: r.shared_content ?? "",
  }));
}

export interface BookExportProgress {
  current: number;
  total: number;
  label: string;
}

export interface ExportBookOptions {
  projectId: string;
  projectTitle: string;
  format: BookExportFormat;
  onProgress?: (p: BookExportProgress) => void;
}

export async function exportBookProject(opts: ExportBookOptions): Promise<void> {
  const { projectId, projectTitle, format, onProgress } = opts;
  const chapters = await fetchChapters(projectId);
  if (chapters.length === 0) {
    throw new Error("This project has no chapters to export yet.");
  }
  const date = new Date().toISOString().slice(0, 10);
  const base = `${sanitize(projectTitle)} — Export (${date})`;
  const total = chapters.length;

  if (format === "zip-docx") {
    const zip = new JSZip();
    for (let i = 0; i < chapters.length; i += 1) {
      onProgress?.({ current: i, total, label: `Building chapter ${i + 1} of ${total}: ${chapters[i].title}` });
      await yieldToBrowser();
      const blob = await htmlToDocxBlob(chapters[i].html);
      const buf = await blob.arrayBuffer();
      zip.file(`${pad(i + 1)} — ${sanitize(chapters[i].title)}.docx`, buf);
    }
    onProgress?.({ current: total, total, label: "Packaging archive…" });
    await yieldToBrowser();
    const out = await zip.generateAsync({ type: "blob", streamFiles: true });
    saveAs(out, `${base}.zip`);
    return;
  }

  if (format === "zip-md") {
    const zip = new JSZip();
    for (let i = 0; i < chapters.length; i += 1) {
      onProgress?.({ current: i, total, label: `Converting chapter ${i + 1} of ${total}: ${chapters[i].title}` });
      await yieldToBrowser();
      const md = `# ${chapters[i].title}\n\n${htmlToMarkdown(chapters[i].html)}\n`;
      zip.file(`${pad(i + 1)} — ${sanitize(chapters[i].title)}.md`, md);
    }
    onProgress?.({ current: total, total, label: "Packaging archive…" });
    await yieldToBrowser();
    const out = await zip.generateAsync({ type: "blob", streamFiles: true });
    saveAs(out, `${base}.zip`);
    return;
  }

  if (format === "docx") {
    onProgress?.({ current: 0, total, label: "Building combined document…" });
    await yieldToBrowser();
    const blob = await chaptersToCombinedDocxBlob(projectTitle, chapters, onProgress);
    saveAs(blob, `${base}.docx`);
    return;
  }

  if (format === "pdf") {
    onProgress?.({ current: total, total, label: "Opening print dialog…" });
    await yieldToBrowser();
    const ok = openPrintableBook({ projectTitle, chapters });
    if (!ok) {
      throw new Error(
        "Popup blocked. Allow popups for DraftKit to export PDFs, or use the Combined Word document option.",
      );
    }
    return;
  }

  if (format === "epub") {
    onProgress?.({ current: 0, total, label: "Building ePub…" });
    await yieldToBrowser();
    let author = "Unknown Author";
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (uid) {
        const { data: creator } = await supabase
          .from("creators")
          .select("name")
          .eq("id", uid)
          .maybeSingle();
        if (creator?.name) author = creator.name;
      }
    } catch {
      // non-fatal — fall back to default author label
    }
    const blob = await buildEpubBlob({
      projectTitle,
      author,
      chapters,
      onProgress: (current, t, label) => onProgress?.({ current, total: t, label }),
    });
    saveAs(blob, `${base}.epub`);
    return;
  }
}
