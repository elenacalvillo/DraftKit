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
 * Extract just the username from a Substack URL
 */
export function extractSubstackUsername(input: string): string | null {
  return normalizeSubstackUrl(input).username;
}
