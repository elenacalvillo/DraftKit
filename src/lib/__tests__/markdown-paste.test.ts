import { describe, it, expect } from "vitest";
import {
  htmlIsPlainTextWrapper,
  looksLikeMarkdown,
  markdownToSanitizedHtml,
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
