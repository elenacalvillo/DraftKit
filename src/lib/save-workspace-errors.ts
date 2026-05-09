/**
 * Pure helpers for translating `save_workspace_content` RPC failures into
 * (a) a stable analytics `reason` token, and (b) a user-facing message.
 *
 * Kept dependency-free so the regression test can lock in the typed-error
 * contract without booting React or Supabase.
 */

export type SaveFailureReason =
  | "not_authenticated"
  | "not_a_participant"
  | "status_not_approved"
  | "request_not_found"
  | "network_error"
  | "unknown";

export interface ParsedSaveError {
  reason: SaveFailureReason;
  /** Optional sub-detail (e.g. the actual status from `status_not_approved:cancelled`). */
  detail?: string;
  /** Human-readable message safe to render in a toast. */
  friendly: string;
}

const FRIENDLY: Record<SaveFailureReason, (detail?: string) => string> = {
  not_authenticated: () =>
    "You're not signed in. Please log in and try again.",
  not_a_participant: () =>
    "Your account isn't linked to this collaboration. Try signing out and signing back in with the email that received the invite.",
  status_not_approved: (detail) =>
    `This collaboration is ${detail ?? "no longer active"}, so the workspace is read-only.`,
  request_not_found: () => "This collaboration no longer exists.",
  network_error: () =>
    "We couldn't reach the server. Your draft is preserved locally on this device.",
  unknown: () =>
    "Your changes are NOT in the database. Your draft is preserved locally on this device — please copy your work as a backup.",
};

export function parseSaveError(input: unknown): ParsedSaveError {
  const raw =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : input && typeof input === "object" && "message" in (input as Record<string, unknown>)
          ? String((input as Record<string, unknown>).message ?? "")
          : "";

  const lower = raw.toLowerCase();

  if (raw.includes("not_authenticated")) {
    return { reason: "not_authenticated", friendly: FRIENDLY.not_authenticated() };
  }
  if (raw.includes("not_a_participant")) {
    return { reason: "not_a_participant", friendly: FRIENDLY.not_a_participant() };
  }
  if (raw.includes("status_not_approved")) {
    const m = raw.match(/status_not_approved:([a-z_]+)/i);
    const detail = m?.[1];
    return {
      reason: "status_not_approved",
      detail,
      friendly: FRIENDLY.status_not_approved(detail),
    };
  }
  if (raw.includes("request_not_found")) {
    return { reason: "request_not_found", friendly: FRIENDLY.request_not_found() };
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("offline")
  ) {
    return { reason: "network_error", friendly: FRIENDLY.network_error() };
  }
  return {
    reason: "unknown",
    friendly: raw || FRIENDLY.unknown(),
  };
}
