// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  htmlIsPlainTextWrapper,
  extractMarkdownCodeWrapper,
  looksLikeMarkdown,
  markdownToSanitizedHtml,
  normalizeLegacyMarkdownContent,
} from "../markdown-paste";

describe("htmlIsPlainTextWrapper", () => {
  it("treats a <pre> wrapper around raw markdown as plain text", () => {
    const text = "**5. What changed (the after)**\nWhere you are now.";
    const html = `<pre>**5. What changed (the after)**\nWhere you are now.</pre>`;
    expect(htmlIsPlainTextWrapper(html, text)).toBe(true);
  });

  it("treats span/div wrappers as plain text", () => {
    const text = "**bold** line";
    const html = `<div><span style="color:#000">**bold** line</span></div>`;
    expect(htmlIsPlainTextWrapper(html, text)).toBe(true);
  });

  it("keeps genuinely rich HTML on the HTML path", () => {
    const text = "Bold line";
    const html = `<p><strong>Bold line</strong></p>`;
    expect(htmlIsPlainTextWrapper(html, text)).toBe(false);
  });

  it("treats a whole language-markdown code wrapper as markdown text", () => {
    const text = "### Structure\n\n**Bold section**";
    const html = `<pre><code class="language-markdown">### Structure\n\n**Bold section**</code></pre>`;
    expect(htmlIsPlainTextWrapper(html, text)).toBe(true);
  });

  it("keeps Google Docs style clips on the HTML path", () => {
    const html = `<!--StartFragment--><ul><li>one</li><li>two</li></ul><!--EndFragment-->`;
    expect(htmlIsPlainTextWrapper(html, "one\ntwo")).toBe(false);
  });

  it("returns false when the HTML text differs from the plain text", () => {
    expect(htmlIsPlainTextWrapper("<p>something else</p>", "**bold**")).toBe(false);
  });

  it("returns true for an empty HTML payload", () => {
    expect(htmlIsPlainTextWrapper("", "**bold**")).toBe(true);
  });
});

describe("legacy markdown code wrappers", () => {
  it("extracts markdown and decodes HTML entities", () => {
    const html = `<pre><code class="language-markdown">### Heading\n\nTom &amp; Jerry **bold**</code></pre><p></p>`;
    expect(extractMarkdownCodeWrapper(html)).toBe(
      "### Heading\n\nTom & Jerry **bold**",
    );
  });

  it("normalizes a whole markdown code document to rich HTML", () => {
    const html = `<pre><code class="language-markdown">### Heading\n\n**Bold section**</code></pre><p><br></p>`;
    const normalized = normalizeLegacyMarkdownContent(html);
    expect(normalized).toContain("<h3>Heading</h3>");
    expect(normalized).toContain("<strong>Bold section</strong>");
    expect(normalized).not.toContain("language-markdown");
  });

  it("preserves normal code and rich HTML unchanged", () => {
    const code = `<pre><code class="language-typescript">const x = 1;</code></pre>`;
    const rich = `<p><strong>Already rich</strong></p>`;
    expect(normalizeLegacyMarkdownContent(code)).toBe(code);
    expect(normalizeLegacyMarkdownContent(rich)).toBe(rich);
  });
});

describe("looksLikeMarkdown inline detection", () => {
  it("detects inline bold without any block tokens", () => {
    expect(looksLikeMarkdown("**5. What changed (the after)**")).toBe(true);
  });

  it("detects inline code and links", () => {
    expect(looksLikeMarkdown("run `npm test` first")).toBe(true);
    expect(looksLikeMarkdown("see [docs](https://example.com)")).toBe(true);
  });

  it("leaves ordinary prose alone", () => {
    expect(
      looksLikeMarkdown("Where you are now, honestly. The real trade-offs too."),
    ).toBe(false);
  });
});

describe("markdownToSanitizedHtml", () => {
  it("converts inline bold to <strong>", () => {
    const html = markdownToSanitizedHtml("**5. What changed (the after)**");
    expect(html).toContain("<strong>5. What changed (the after)</strong>");
  });

  it("strips images", () => {
    const html = markdownToSanitizedHtml("![x](https://example.com/a.png)");
    expect(html).not.toContain("<img");
  });
});
