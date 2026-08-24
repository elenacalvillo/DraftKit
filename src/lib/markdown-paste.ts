import { marked } from "marked";
import DOMPurify from "dompurify";

// Tags allowed in the Tiptap workspace editor. Mirrors the public viewer
// whitelist minus <img> (markdown-pasted images must go through the
// existing upload pipeline to honor the 1 GB storage cap and no-base64
// rule).
const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "strong", "em", "s", "u", "code", "pre",
  "a", "ul", "ol", "li", "br", "hr", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td", "span",
];
const ALLOWED_ATTR = ["href", "target", "rel", "colspan", "rowspan", "class"];

// Elements that prove a clipboard's text/html payload carries real
// formatting. Anything else (pre, span, div, p wrappers) is just plain
// text dressed up as HTML by the source app.
const RICH_TAG_RE =
  /<\s*(strong|b|em|i|u|s|h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|a|img|blockquote|code|hr)\b/i;

function htmlToText(html: string): string {
  // Strip the fragment comments Word/Docs inject, drop tags, decode the
  // handful of entities that matter for comparison.
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * True when a clipboard's text/html payload adds nothing over its
 * text/plain twin. Sources like ChatGPT plain copy, Notes, Slack and
 * terminals attach a <pre>/<span> wrapper around raw markdown; treating
 * that as rich HTML pastes literal asterisks into the draft.
 *
 * Rich clips (Google Docs, Word, Notion, Substack) return false so they
 * keep flowing through Tiptap's HTML pipeline untouched.
 */
export function htmlIsPlainTextWrapper(html: string, text: string): boolean {
  if (!html.trim()) return true;
  if (RICH_TAG_RE.test(html)) return false;
  if (!text.trim()) return false;
  return normalizeForCompare(htmlToText(html)) === normalizeForCompare(text);
}

/**
 * Heuristic: does this plain-text blob look like markdown?
 * Conservative — only true when at least one strong markdown token is
 * present, so ordinary prose pastes still behave like plain text.
 */
export function hasStructuralMarkdown(text: string): boolean {
  if (!text) return false;
  const patterns: RegExp[] = [
    /^#{1,6}\s+\S/m,        // # ATX heading
    /^\s*[-*+]\s+\S/m,      // - bullet
    /^\s*\d+\.\s+\S/m,      // 1. ordered list
    /^\s*>\s+\S/m,          // > blockquote
    /^\s*(?:---|\*\*\*|___)\s*$/m, // thematic break
    /^\s*={2,}\s*$/m,       // setext heading underline
    /```/,                  // fenced code block
  ];
  return patterns.some((re) => re.test(text));
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 2) return false;
  const patterns: RegExp[] = [
    /^#{1,6}\s+\S/m,            // # ATX heading
    /^\s*[-*+]\s+\S/m,          // - bullet
    /^\s*\d+\.\s+\S/m,          // 1. ordered list
    /^\s*>\s+\S/m,              // > blockquote
    /^\s*---\s*$/m,             // --- thematic break
    /^\s*===+\s*$/m,            // === setext heading underline
    /```/,                      // fenced code block
    /\*\*[^\s*][^*]*\*\*/,      // **bold**
    /__[^\s_][^_]*__/,          // __bold__
    /(^|\s)\*[^\s*][^*]*\*(\s|$|[.,!?])/, // *italic*
    /`[^`\n]+`/,                // `inline code`
    /\[[^\]]+\]\(https?:[^)]+\)/, // [link](http…)
    /!\[[^\]]*\]\([^)]+\)/,     // ![image](…)
  ];
  return patterns.some((re) => re.test(text));
}

/**
 * Convert markdown text to sanitized HTML suitable for direct insertion
 * into the Tiptap workspace editor. Images and data: URIs are stripped.
 */
export function markdownToSanitizedHtml(md: string): string {
  const rawHtml = marked.parse(md, {
    gfm: true,
    breaks: false,
    async: false,
  }) as string;

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
}
