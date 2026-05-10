/**
 * Tests for substack-url helpers.
 *
 * Focus: `resolveSubstackPublishUrl` — added for DRAFT-002 / Push to Substack.
 * The resolver determines which Substack composer URL to open in a new tab
 * when a Pro user clicks "Push to Substack". The priority order is:
 *
 *   1. creator.newsletter_url (preferred — required, validated)
 *   2. creator.substack_url (optional fallback)
 *   3. https://substack.com/publish (generic, always-safe fallback)
 *
 * Each candidate runs through `normalizeSubstackUrl`, so any of the
 * supported input formats (bare username, mobile share, profile, etc.)
 * resolve to the same canonical `${username}.substack.com` subdomain.
 */
import { describe, it, expect } from "vitest";
import {
  SUBSTACK_GENERIC_PUBLISH_URL,
  resolveSubstackPublishUrl,
} from "../substack-url";

describe("resolveSubstackPublishUrl", () => {
  it("uses newsletter_url when it is a valid Substack publication URL", () => {
    expect(
      resolveSubstackPublishUrl("https://elena.substack.com", null),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("prefers newsletter_url over substack_url when both are valid", () => {
    // newsletter_url is the more reliable signal (required + validated),
    // so we never fall through to substack_url when newsletter_url works.
    expect(
      resolveSubstackPublishUrl(
        "https://newsletter.substack.com",
        "https://other.substack.com",
      ),
    ).toBe("https://newsletter.substack.com/publish/post/new");
  });

  it("falls through to substack_url when newsletter_url is null", () => {
    expect(
      resolveSubstackPublishUrl(null, "https://elena.substack.com"),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("falls through to substack_url when newsletter_url is undefined", () => {
    expect(
      resolveSubstackPublishUrl(undefined, "elena.substack.com"),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("falls through to substack_url when newsletter_url is an empty string", () => {
    // Empty / whitespace strings should not block the fallback chain —
    // some imported profiles have "" rather than null.
    expect(
      resolveSubstackPublishUrl("", "elena.substack.com"),
    ).toBe("https://elena.substack.com/publish/post/new");
    expect(
      resolveSubstackPublishUrl("   ", "elena.substack.com"),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("falls through to substack_url when newsletter_url is not a Substack URL", () => {
    expect(
      resolveSubstackPublishUrl(
        "https://example.com/blog",
        "https://elena.substack.com",
      ),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("returns the generic fallback when both URLs are null", () => {
    expect(resolveSubstackPublishUrl(null, null)).toBe(
      SUBSTACK_GENERIC_PUBLISH_URL,
    );
    expect(resolveSubstackPublishUrl(undefined, undefined)).toBe(
      SUBSTACK_GENERIC_PUBLISH_URL,
    );
  });

  it("returns the generic fallback when both URLs are non-Substack", () => {
    // Creator uses Beehiiv / Ghost / etc. — we still open a Substack tab
    // because the user clicked "Push to Substack"; Substack's router will
    // land them on whichever publication they're signed into.
    expect(
      resolveSubstackPublishUrl(
        "https://example.com/newsletter",
        "https://beehiiv.com/me",
      ),
    ).toBe(SUBSTACK_GENERIC_PUBLISH_URL);
  });

  it("normalizes mobile share URLs (open.substack.com/pub/...)", () => {
    expect(
      resolveSubstackPublishUrl(
        "https://open.substack.com/pub/elena?utm_source=share",
        null,
      ),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("normalizes profile URLs (substack.com/@user)", () => {
    expect(
      resolveSubstackPublishUrl("https://substack.com/@elena", null),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("normalizes bare-username inputs", () => {
    // Some legacy profile rows store just the username (no domain).
    expect(resolveSubstackPublishUrl("elena", null)).toBe(
      "https://elena.substack.com/publish/post/new",
    );
  });

  it("lowercases the resolved subdomain (Substack subdomains are case-insensitive)", () => {
    // Avoid confusing duplicate-tab opens for the same publication.
    expect(
      resolveSubstackPublishUrl("https://Elena.Substack.com", null),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("ignores trailing query / fragment / slashes on the source URL", () => {
    expect(
      resolveSubstackPublishUrl(
        "https://elena.substack.com/?utm=newsletter#top",
        null,
      ),
    ).toBe("https://elena.substack.com/publish/post/new");
  });

  it("never returns null or empty string", () => {
    // Callers feed this directly into window.open() — a falsy value would
    // navigate to the current page, which violates the 'never leave
    // DraftKit' constraint.
    const out = resolveSubstackPublishUrl(null, null);
    expect(out).toBeTruthy();
    expect(typeof out).toBe("string");
  });
});
