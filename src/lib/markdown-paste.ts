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

/**
 * Heuristic: does this plain-text blob look like markdown?
 * Conservative — only true when at least one strong markdown token is
 * present, so ordinary prose pastes still behave like plain text.
 */
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
