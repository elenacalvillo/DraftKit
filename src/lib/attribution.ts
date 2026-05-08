// Attribution helpers — capture how a visitor arrived (referral link,
// invite, discovery, email) and persist that context across the
// pre-signup hop so we can attribute the resulting `user_signup`.
//
// Stored in sessionStorage under a single key so it survives OAuth
// round-trips inside the same tab.

export type AttributionSource =
  | "invite"
  | "referral"
  | "discovery"
  | "email"
  | "landing"
  | "direct";

export interface Attribution {
  source: AttributionSource;
  ref_username?: string;
  invite_request_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  captured_at: number;
}

const KEY = "dk_attribution";
const EMITTED_KEY = "dk_attribution_emitted";

export function readAttribution(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Attribution;
  } catch {
    return null;
  }
}

export function writeAttribution(a: Attribution) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export function markAttributionEmitted() {
  try {
    sessionStorage.setItem(EMITTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function wasAttributionEmitted(): boolean {
  try {
    return sessionStorage.getItem(EMITTED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Capture attribution from the current URL into sessionStorage.
 * Call once on PublicBooking mount (and other public landing pages
 * that act as conversion entry points). Returns the captured
 * Attribution if anything new was recorded.
 */
export function captureAttributionFromUrl(
  search: URLSearchParams,
  fallback: AttributionSource = "landing",
): Attribution | null {
  const ref = search.get("ref");
  const invitedBy = search.get("invited_by");
  const inviteReq = search.get("invite_request_id");
  const utm_source = search.get("utm_source") ?? undefined;
  const utm_medium = search.get("utm_medium") ?? undefined;
  const utm_campaign = search.get("utm_campaign") ?? undefined;

  // Don't overwrite a richer prior attribution (e.g. don't downgrade
  // an "invite" attribution to plain "landing" on re-navigation).
  const existing = readAttribution();
  if (
    existing &&
    !ref &&
    !invitedBy &&
    !inviteReq &&
    utm_source !== "email"
  ) {
    return existing;
  }

  let source: AttributionSource = fallback;
  if (inviteReq || invitedBy) source = "invite";
  else if (ref) source = "referral";
  else if (utm_source === "email") source = "email";

  const next: Attribution = {
    source,
    ref_username: ref ?? undefined,
    invite_request_id: inviteReq ?? invitedBy ?? undefined,
    utm_source,
    utm_medium,
    utm_campaign,
    captured_at: Date.now(),
  };
  writeAttribution(next);
  return next;
}
