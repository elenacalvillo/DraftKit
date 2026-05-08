/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  MAX_EXTERNAL_LINKS,
  MAX_LABEL_LENGTH,
  MAX_URL_LENGTH,
  detectLabelFromUrl,
  getDisplayLabel,
  isValidExternalUrl,
  parseExternalLinks,
  sanitizeLinkHref,
  sanitizeLinkLabel,
  serializeExternalLinks,
  validateExternalUrl,
} from "../external-links";

describe("DRAFT-002: external link constants", () => {
  it("encodes the limits in the ticket", () => {
    expect(MAX_EXTERNAL_LINKS).toBe(10);
    expect(MAX_URL_LENGTH).toBe(2048);
    expect(MAX_LABEL_LENGTH).toBeGreaterThan(0);
  });
});

describe("validateExternalUrl", () => {
  it("accepts well-formed https URLs", () => {
    for (const u of [
      "https://linkedin.com/in/elena",
      "https://calendly.com/elena/intro",
      "https://elena.dev",
      "https://x.com/elena",
    ]) {
      expect(validateExternalUrl(u).valid).toBe(true);
    }
  });

  it("rejects http://, javascript:, data:, and other non-https schemes", () => {
    const cases: [string, string][] = [
      ["http://example.com", "non_https"],
      ["javascript:alert(1)", "non_https"],
      ["data:text/html,foo", "non_https"],
      ["ftp://example.com", "non_https"],
    ];
    for (const [u, expected] of cases) {
      const r = validateExternalUrl(u);
      expect(r.valid).toBe(false);
      expect(r.error).toBe(expected);
    }
  });

  it("rejects empty / whitespace-only / non-string inputs", () => {
    expect(validateExternalUrl("").error).toBe("empty");
    expect(validateExternalUrl("   ").error).toBe("empty");
    expect(validateExternalUrl(undefined).error).toBe("empty");
    expect(validateExternalUrl(null).error).toBe("empty");
  });

  it("rejects malformed URLs", () => {
    const r = validateExternalUrl("not a url");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("invalid_url");
  });

  it("enforces the max URL length", () => {
    const long = "https://example.com/" + "a".repeat(MAX_URL_LENGTH);
    const r = validateExternalUrl(long);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("too_long");
  });

  it("isValidExternalUrl is the boolean form", () => {
    expect(isValidExternalUrl("https://elena.dev")).toBe(true);
    expect(isValidExternalUrl("http://elena.dev")).toBe(false);
  });
});

describe("detectLabelFromUrl", () => {
  it("recognises common platforms", () => {
    expect(detectLabelFromUrl("https://www.linkedin.com/in/elena")).toBe("LinkedIn");
    expect(detectLabelFromUrl("https://x.com/elena")).toBe("X");
    expect(detectLabelFromUrl("https://twitter.com/elena")).toBe("Twitter");
    expect(detectLabelFromUrl("https://calendly.com/elena")).toBe("Calendly");
    expect(detectLabelFromUrl("https://github.com/elena")).toBe("GitHub");
    expect(detectLabelFromUrl("https://elena.substack.com")).toBe("Substack");
  });

  it("falls back to 'Website' for unknown hosts", () => {
    expect(detectLabelFromUrl("https://random-domain.example/path")).toBe("Website");
  });

  it("returns 'Website' for malformed URLs", () => {
    expect(detectLabelFromUrl("not a url")).toBe("Website");
  });
});

describe("sanitizeLinkLabel / sanitizeLinkHref", () => {
  it("strips HTML tags from labels", () => {
    expect(sanitizeLinkLabel("<script>alert(1)</script>Calendly")).toBe("Calendly");
    expect(sanitizeLinkLabel("<b>My</b> site")).toBe("My site");
  });

  it("clamps overly long labels", () => {
    const long = "a".repeat(500);
    expect(sanitizeLinkLabel(long).length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
  });

  it("returns null for unsafe hrefs", () => {
    expect(sanitizeLinkHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeLinkHref("http://example.com")).toBeNull();
    expect(sanitizeLinkHref("")).toBeNull();
    expect(sanitizeLinkHref(null)).toBeNull();
  });

  it("returns the trimmed URL for safe hrefs", () => {
    expect(sanitizeLinkHref("  https://elena.dev  ")).toBe("https://elena.dev");
  });
});

describe("parseExternalLinks", () => {
  it("returns [] for null/undefined/empty/non-array values", () => {
    expect(parseExternalLinks(null)).toEqual([]);
    expect(parseExternalLinks(undefined)).toEqual([]);
    expect(parseExternalLinks("")).toEqual([]);
    expect(parseExternalLinks(42)).toEqual([]);
    expect(parseExternalLinks({ url: "https://elena.dev" })).toEqual([]);
  });

  it("parses both arrays and JSON strings", () => {
    const links = [{ url: "https://elena.dev", label: "Site" }];
    expect(parseExternalLinks(links)).toEqual(links);
    expect(parseExternalLinks(JSON.stringify(links))).toEqual(links);
  });

  it("drops entries with invalid URLs (no crash, just skip)", () => {
    const messy = [
      { url: "javascript:alert(1)", label: "Bad" },
      { url: "http://insecure.com", label: "Insecure" },
      { url: "https://elena.dev", label: "Site" },
      { url: "" },
      { url: "not-a-url" },
      "not-an-object",
      null,
    ];
    expect(parseExternalLinks(messy)).toEqual([
      { url: "https://elena.dev", label: "Site" },
    ]);
  });

  it("caps the result at MAX_EXTERNAL_LINKS", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      url: `https://example${i}.com`,
    }));
    expect(parseExternalLinks(many).length).toBe(MAX_EXTERNAL_LINKS);
  });

  it("strips HTML from labels", () => {
    const result = parseExternalLinks([
      { url: "https://elena.dev", label: "<script>x</script>Calendly" },
    ]);
    expect(result).toEqual([{ url: "https://elena.dev", label: "Calendly" }]);
  });

  it("returns [] when JSON parsing fails", () => {
    expect(parseExternalLinks("{ not json")).toEqual([]);
  });
});

describe("serializeExternalLinks", () => {
  it("produces a string parseable by parseExternalLinks", () => {
    const links = [{ url: "https://elena.dev", label: "Site" }];
    const serialised = serializeExternalLinks(links);
    expect(typeof serialised).toBe("string");
    expect(parseExternalLinks(serialised)).toEqual(links);
  });

  it("filters invalid entries during serialisation", () => {
    const links = [
      { url: "https://elena.dev" },
      // @ts-expect-error - exercising runtime invariants
      { url: "javascript:alert(1)" },
    ];
    const out = JSON.parse(serializeExternalLinks(links));
    expect(out).toEqual([{ url: "https://elena.dev" }]);
  });
});

describe("getDisplayLabel", () => {
  it("prefers the explicit label", () => {
    expect(getDisplayLabel({ url: "https://x.com/elena", label: "Twitter (X)" })).toBe(
      "Twitter (X)",
    );
  });

  it("falls back to a domain-detected label", () => {
    expect(getDisplayLabel({ url: "https://linkedin.com/in/elena" })).toBe("LinkedIn");
  });
});
