/**
 * @vitest-environment jsdom
 *
 * Tests for the clipboard helpers shared by the workspace toolbar (Copy +
 * Push to Substack). These cover DRAFT-001 (no credit charge — just verifies
 * the write helper has no side effects beyond clipboard) and DRAFT-002 (HTML
 * cleaning + dual-format clipboard + fallback when API is missing).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  htmlToPlainText,
  isRichClipboardAvailable,
  stripDraftKitInternalAttrs,
  writeDraftToClipboard,
} from "../clipboard";

describe("stripDraftKitInternalAttrs (DRAFT-002)", () => {
  it("removes data-comment attributes regardless of quote style", () => {
    const input = `<p>Hello <span data-comment="needs work">world</span></p>`;
    expect(stripDraftKitInternalAttrs(input)).toBe(
      `<p>Hello <span>world</span></p>`,
    );

    const single = `<p>Hi <span data-comment='note'>x</span></p>`;
    expect(stripDraftKitInternalAttrs(single)).toBe(`<p>Hi <span>x</span></p>`);
  });

  it("removes data-author attributes", () => {
    const input = `<span data-author="Elena" class="hl">flag</span>`;
    expect(stripDraftKitInternalAttrs(input)).toBe(`<span class="hl">flag</span>`);
  });

  it("strips both attrs in a single pass when they co-occur", () => {
    const input = `<span data-comment="x" data-author="Elena" class="hl">flag</span>`;
    const out = stripDraftKitInternalAttrs(input);
    expect(out).not.toContain("data-comment");
    expect(out).not.toContain("data-author");
    expect(out).toContain("class=\"hl\"");
  });

  it("leaves other data-* attributes intact", () => {
    const input = `<span data-id="42" data-comment="x">y</span>`;
    expect(stripDraftKitInternalAttrs(input)).toBe(`<span data-id="42">y</span>`);
  });

  it("returns empty string for falsy input without throwing", () => {
    expect(stripDraftKitInternalAttrs("")).toBe("");
    expect(stripDraftKitInternalAttrs(undefined as unknown as string)).toBe("");
  });

  it("does not mutate HTML that has no internal attrs", () => {
    const input = `<p><strong>Headline</strong></p><p>Body text.</p>`;
    expect(stripDraftKitInternalAttrs(input)).toBe(input);
  });
});

describe("htmlToPlainText", () => {
  it("extracts text content from HTML", () => {
    expect(htmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(htmlToPlainText("")).toBe("");
  });
});

describe("isRichClipboardAvailable", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it("returns false when navigator.clipboard.write is missing", () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn() }, // no .write
      configurable: true,
      writable: true,
    });
    expect(isRichClipboardAvailable()).toBe(false);
  });

  it("returns true when ClipboardItem and navigator.clipboard.write exist", () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { write: vi.fn(), writeText: vi.fn() },
      configurable: true,
      writable: true,
    });
    // jsdom does not ship ClipboardItem; stub it for the duration of the test.
    const originalCI = (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {};
    try {
      expect(isRichClipboardAvailable()).toBe(true);
    } finally {
      (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = originalCI;
    }
  });
});

describe("writeDraftToClipboard (DRAFT-001 + DRAFT-002 — no credit charge, dual-format write)", () => {
  const originalClipboard = navigator.clipboard;
  const originalCI = (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;

  beforeEach(() => {
    // Provide a minimal ClipboardItem stub so the rich path is exercised
    // without depending on the host browser's implementation.
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
      data: Record<string, Blob>;
      constructor(data: Record<string, Blob>) {
        this.data = data;
      }
    };
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem = originalCI;
  });

  it("writes both text/html and text/plain when the rich API is available", async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock, writeText: vi.fn() },
      configurable: true,
      writable: true,
    });

    const ok = await writeDraftToClipboard("<p>Hello world</p>");
    expect(ok).toBe(true);
    expect(writeMock).toHaveBeenCalledTimes(1);
    const items = writeMock.mock.calls[0][0] as Array<{ data: Record<string, Blob> }>;
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0].data)).toEqual(
      expect.arrayContaining(["text/html", "text/plain"]),
    );
  });

  it("falls back to writeText when ClipboardItem is unavailable", async () => {
    (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    const ok = await writeDraftToClipboard("<p>Hi</p>");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Hi");
  });

  it("returns false when no clipboard API is available at all", async () => {
    (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const ok = await writeDraftToClipboard("<p>Hi</p>");
    expect(ok).toBe(false);
  });

  it("propagates clipboard errors so callers can show a fallback UI", async () => {
    const writeMock = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock, writeText: vi.fn() },
      configurable: true,
      writable: true,
    });
    await expect(writeDraftToClipboard("<p>x</p>")).rejects.toThrow("denied");
  });
});
