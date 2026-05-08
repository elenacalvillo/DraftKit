/**
 * External Links (DRAFT-002)
 *
 * A creator can attach up to MAX_EXTERNAL_LINKS links (LinkedIn, X/Twitter,
 * a personal website, an external scheduling tool such as Calendly, etc.)
 * to their profile. Each link is rendered on the public booking page in a
 * new tab with `rel="noopener noreferrer"`.
 *
 * Validation is format-only — we never make a network request to confirm
 * the destination is reachable. Only `https://` URLs are accepted; any
 * other scheme (`http://`, `javascript:`, `data:`, etc.) is rejected.
 */

import DOMPurify from "dompurify";

export const MAX_EXTERNAL_LINKS = 10;
export const MAX_URL_LENGTH = 2048;
export const MAX_LABEL_LENGTH = 60;

export interface ExternalLink {
  url: string;
  label?: string;
}

export type ExternalLinkValidationError =
  | "empty"
  | "too_long"
  | "invalid_url"
  | "non_https";

export interface UrlValidationResult {
  valid: boolean;
  error?: ExternalLinkValidationError;
  message?: string;
}

const VALIDATION_MESSAGES: Record<ExternalLinkValidationError, string> = {
  empty: "URL is required",
  too_long: `URL must be at most ${MAX_URL_LENGTH} characters`,
  invalid_url: "Enter a valid URL (e.g., https://example.com)",
  non_https: "Only https:// links are accepted",
};

/**
 * Validate a single URL string. Returns a structured result so the caller can
 * decide how to surface the error. Trims whitespace before validating.
 */
export function validateExternalUrl(value: unknown): UrlValidationResult {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return { valid: false, error: "empty", message: VALIDATION_MESSAGES.empty };
  }
  if (raw.length > MAX_URL_LENGTH) {
    return { valid: false, error: "too_long", message: VALIDATION_MESSAGES.too_long };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, error: "invalid_url", message: VALIDATION_MESSAGES.invalid_url };
  }

  // Reject everything that isn't strictly HTTPS — `http:`, `javascript:`,
  // `data:`, `file:`, custom schemes, etc.
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "non_https", message: VALIDATION_MESSAGES.non_https };
  }
  // `URL` parses some odd inputs (e.g. `https:foo`) without a hostname; reject
  // those too.
  if (!parsed.hostname) {
    return { valid: false, error: "invalid_url", message: VALIDATION_MESSAGES.invalid_url };
  }

  return { valid: true };
}

/**
 * Convenience boolean predicate built on top of validateExternalUrl.
 */
export function isValidExternalUrl(value: unknown): boolean {
  return validateExternalUrl(value).valid;
}

/**
 * Best-effort label inference from the URL hostname. Used when the creator
 * doesn't provide an explicit label.
 */
export function detectLabelFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("linkedin.com")) return "LinkedIn";
    if (host === "x.com" || host.endsWith(".x.com")) return "X";
    if (host.includes("twitter.com")) return "Twitter";
    if (host.includes("calendly.com")) return "Calendly";
    if (host.includes("cal.com")) return "Cal.com";
    if (host.includes("substack.com")) return "Substack";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("github.com")) return "GitHub";
    if (host.includes("threads.net")) return "Threads";
    if (host.includes("bsky.app") || host.includes("bsky.social")) return "Bluesky";
    if (host.includes("mastodon")) return "Mastodon";
    // Strip the TLD and capitalize the registrable name. e.g.
    // "elenaverna.com" -> "Elenaverna" -> "Website".
    const labelParts = host.split(".");
    if (labelParts.length === 0 || !labelParts[0]) return "Website";
    return "Website";
  } catch {
    return "Website";
  }
}

/**
 * Sanitize a user-supplied label so we never render uncontrolled HTML.
 * DOMPurify with no allowed tags strips everything; we then trim and clamp.
 */
export function sanitizeLinkLabel(label: string | null | undefined): string {
  if (!label) return "";
  const stripped = DOMPurify.sanitize(String(label), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return "";
  return stripped.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Sanitize a URL for safe rendering. Returns `null` when the URL is unsafe
 * (e.g. `javascript:` or any non-https scheme), so the caller knows to drop
 * the entry rather than render a dangerous href.
 */
export function sanitizeLinkHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  const result = validateExternalUrl(trimmed);
  if (!result.valid) return null;
  // DOMPurify's default policy already rejects javascript: URIs, but we run
  // it for a second layer of defence and to normalise whitespace.
  const safe = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
  return safe || null;
}

/**
 * Normalise a list of links from the database (which may be loosely typed
 * JSON) into a clean, capped, sanitised array of valid `ExternalLink`
 * objects. Invalid entries are silently dropped — they can never have been
 * saved through the normal flow because we validate on save, but old rows or
 * direct DB writes shouldn't crash the UI.
 */
export function parseExternalLinks(value: unknown): ExternalLink[] {
  if (!value) return [];

  let arr: unknown;
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  } else {
    arr = value;
  }

  if (!Array.isArray(arr)) return [];

  const out: ExternalLink[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const rawUrl = (entry as { url?: unknown }).url;
    const rawLabel = (entry as { label?: unknown }).label;

    const url = sanitizeLinkHref(typeof rawUrl === "string" ? rawUrl : null);
    if (!url) continue;

    const label = sanitizeLinkLabel(typeof rawLabel === "string" ? rawLabel : null);
    out.push(label ? { url, label } : { url });

    if (out.length >= MAX_EXTERNAL_LINKS) break;
  }

  return out;
}

/**
 * Serialize the links for storage. The DB column is JSON-as-text, so we
 * stringify; consumers who want a value to pass directly into supabase can
 * use this. Strips invalid entries before serialising.
 */
export function serializeExternalLinks(links: ExternalLink[]): string {
  const cleaned = parseExternalLinks(links);
  return JSON.stringify(cleaned);
}

/**
 * Display label for a link — falls back to the auto-detected label, then to
 * a plain "Link" so the UI never renders an empty button.
 */
export function getDisplayLabel(link: ExternalLink): string {
  const explicit = sanitizeLinkLabel(link.label);
  if (explicit) return explicit;
  return detectLabelFromUrl(link.url);
}
