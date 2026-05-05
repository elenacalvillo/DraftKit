/**
 * Helpers for rendering the public workspace invitation view (DRAFT-003).
 *
 * Centralized here so the fallbacks for null `invite_message` /
 * `creator_profile_image_url` are easy to test without standing up
 * the whole page component.
 */

export const DEFAULT_INVITE_MESSAGE =
  "Review the draft and share your thoughts";

/** Soft character limit for invite_message (matches the modal counter). */
export const INVITE_MESSAGE_SOFT_LIMIT = 280;

/**
 * Returns the message to render in the invitation hero.
 * Falls back to `DEFAULT_INVITE_MESSAGE` when the creator hasn't
 * written one (existing rows ship with NULL).
 */
export function getInviteMessage(message: string | null | undefined): string {
  if (typeof message !== "string") return DEFAULT_INVITE_MESSAGE;
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_INVITE_MESSAGE;
}

/**
 * Builds the up-to-2-letter initials shown when the creator has no
 * profile_image_url. Mirrors the avatar-fallback convention used
 * elsewhere in the app.
 */
export function getInviterInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Action-oriented CTA copy for the invitation page. Replaces the old
 * "Enter Writer's Room" wording, which was opaque to first-time
 * collaborators (DRAFT-003).
 */
export function getInviteCtaLabel(creatorName: string | null | undefined): string {
  const first = creatorName?.trim().split(/\s+/)[0];
  return first ? `Review ${first}'s Draft` : "Open Collaboration";
}
