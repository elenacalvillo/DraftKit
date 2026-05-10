/**
 * Centralized Substack URL normalization utility
 * Handles all known Substack URL formats and normalizes them to: https://username.substack.com
 */

export interface NormalizeResult {
  isValid: boolean;
  normalized: string | null;
  username: string | null;
  error?: string;
}

/**
 * Normalize any Substack URL format to the canonical https://username.substack.com format
 *
 * Supported formats:
 * - username.substack.com
 * - https://username.substack.com
 * - substack.com/@username
 * - open.substack.com/pub/username?query=params (mobile share format)
 * - Bare username (e.g., "cashandcache")
 */
export function normalizeSubstackUrl(input: string): NormalizeResult {
  if (!input || typeof input !== 'string') {
    return { isValid: false, normalized: null, username: null, error: "Please enter a Substack URL" };
  }

  let url = input.trim();

  // Remove query parameters and hash fragments
  url = url.replace(/[?#].*$/, '');

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // Remove protocol for pattern matching
  const withoutProtocol = url.replace(/^https?:\/\//, '');

  // Pattern 1: open.substack.com/pub/username (Mobile share format)
  const mobileMatch = withoutProtocol.match(/^open\.substack\.com\/pub\/([a-zA-Z0-9_-]+)/i);
  if (mobileMatch) {
    const username = mobileMatch[1].toLowerCase();
    return {
      isValid: true,
      normalized: `https://${username}.substack.com`,
      username,
    };
  }

  // Pattern 2: substack.com/@username (Profile format)
  const profileMatch = withoutProtocol.match(/^(?:www\.)?substack\.com\/@([a-zA-Z0-9_-]+)/i);
  if (profileMatch) {
    const username = profileMatch[1].toLowerCase();
    return {
      isValid: true,
      normalized: `https://${username}.substack.com`,
      username,
    };
  }

  // Pattern 3: username.substack.com (Standard format)
  const standardMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]*)\.substack\.com(?:\/.*)?$/i);
  if (standardMatch) {
    const username = standardMatch[1].toLowerCase();
    return {
      isValid: true,
      normalized: `https://${username}.substack.com`,
      username,
    };
  }

  // Pattern 4: Bare username (no dots or slashes)
  // Must be alphanumeric with optional hyphens/underscores, 2-50 chars
  const bareUsernameMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]{1,49})$/);
  if (bareUsernameMatch && !withoutProtocol.includes('.') && !withoutProtocol.includes('/')) {
    const username = bareUsernameMatch[1].toLowerCase();
    return {
      isValid: true,
      normalized: `https://${username}.substack.com`,
      username,
    };
  }

  // Not a recognized Substack URL format
  return {
    isValid: false,
    normalized: null,
    username: null,
    error: "Please enter a valid Substack URL (e.g., yourname.substack.com or paste any Substack link)",
  };
}

/**
 * Check if input is a valid Substack URL
 */
export function isValidSubstackUrl(input: string): boolean {
  return normalizeSubstackUrl(input).isValid;
}

/**
 * Check if input is a valid newsletter publication URL (NOT a profile URL)
 * Profile URLs like substack.com/@username are rejected because they don't have RSS feeds
 *
 * This is stricter than isValidSubstackUrl - use this when you need to fetch RSS/content
 */
export function isValidNewsletterPublicationUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  let url = input.trim();
  url = url.replace(/[?#].*$/, '');
  url = url.replace(/\/+$/, '');
  const withoutProtocol = url.replace(/^https?:\/\//, '');

  // REJECT: substack.com/@username (Profile URLs don't have RSS feeds)
  const profileMatch = withoutProtocol.match(/^(?:www\.)?substack\.com\/@/i);
  if (profileMatch) {
    return false;
  }

  // ACCEPT: open.substack.com/pub/username (Mobile share - points to publication)
  const mobileMatch = withoutProtocol.match(/^open\.substack\.com\/pub\/([a-zA-Z0-9_-]+)/i);
  if (mobileMatch) return true;

  // ACCEPT: username.substack.com (Standard newsletter format)
  const standardMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]*)\.substack\.com(?:\/.*)?$/i);
  if (standardMatch) return true;

  // ACCEPT: Bare username (will be converted to username.substack.com)
  const bareUsernameMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]{1,49})$/);
  if (bareUsernameMatch && !withoutProtocol.includes('.') && !withoutProtocol.includes('/')) {
    return true;
  }

  return false;
}

/**
 * Extract just the username from a Substack URL
 */
export function extractSubstackUsername(input: string): string | null {
  return normalizeSubstackUrl(input).username;
}

/**
 * Generic Substack publish entry point. We open this when we cannot resolve
 * the user's own publication subdomain — Substack's own router will redirect
 * the user to whichever publication they are signed into. Always-safe fallback.
 */
export const SUBSTACK_GENERIC_PUBLISH_URL = "https://substack.com/publish";

/**
 * Resolve the URL that "Push to Substack" should open in a new tab for the
 * current user. We deliberately do NOT require any new DB column or input
 * modal — both fields below already live on the creator profile (DRAFT-002).
 *
 * Resolution order:
 *   1. `newsletterUrl` — the required, validated publication URL on the
 *      creator profile. Most reliable signal.
 *   2. `substackUrl` — optional fallback. May be a profile or publication URL.
 *   3. Generic `https://substack.com/publish` — fires when the user has no
 *      Substack URL at all, or uses a non-Substack platform. Substack's
 *      router will land them on their own publication composer once signed
 *      in, so this is still useful (never silently fail).
 *
 * Each candidate runs through `normalizeSubstackUrl` so that any of the
 * supported input formats (bare username, mobile share, profile URL, etc.)
 * resolve to the same canonical `${username}.substack.com` subdomain.
 */
export function resolveSubstackPublishUrl(
  newsletterUrl: string | null | undefined,
  substackUrl: string | null | undefined,
): string {
  for (const candidate of [newsletterUrl, substackUrl]) {
    if (!candidate || typeof candidate !== "string" || !candidate.trim()) continue;
    const result = normalizeSubstackUrl(candidate);
    if (result.isValid && result.username) {
      return `https://${result.username}.substack.com/publish/post/new`;
    }
  }
  return SUBSTACK_GENERIC_PUBLISH_URL;
}
