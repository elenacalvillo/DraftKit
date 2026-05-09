/**
 * Helpers for describing the participants of a collab workspace in a single
 * human-readable string. Centralized so emails and UI surfaces stop rendering
 * "X and X" when a request is solo (creator === requester) or when extra
 * collaborators are involved.
 */

export interface ParticipantsInput {
  creatorName: string | null | undefined;
  requesterName: string | null | undefined;
  isSolo: boolean;
  /** Extra invited collaborators (email-based or registered). */
  collaboratorNames?: ReadonlyArray<string | null | undefined>;
}

function clean(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Returns a list of unique participant display names, in canonical order:
 * host (creator) first, then requester (if distinct & non-solo), then any
 * extra collaborators (deduped, order preserved).
 */
export function getParticipantNames(input: ParticipantsInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string | null | undefined) => {
    const v = clean(raw);
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  push(input.creatorName);
  if (!input.isSolo) push(input.requesterName);
  for (const c of input.collaboratorNames ?? []) push(c);

  return out;
}

/**
 * Renders the participants line for emails / cards. Examples:
 *   solo, no collabs:        "Karen Smiley (solo)"
 *   solo + 1 collab:         "Karen Smiley and Elena Calvillo"
 *   duo:                     "Karen Smiley and Elena Calvillo"
 *   duo + 1 extra:           "Karen Smiley, Elena Calvillo and Tina Sharma"
 *   duo + 3 extras:          "Karen Smiley, Elena Calvillo and 3 others"
 *   nothing usable:          "" (caller decides fallback)
 */
export function describeParticipants(input: ParticipantsInput): string {
  const names = getParticipantNames(input);

  if (names.length === 0) return "";

  if (names.length === 1) {
    return input.isSolo ? `${names[0]} (solo)` : names[0];
  }

  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;

  // 4+: show first two, then "and N others"
  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${others} others`;
}

/**
 * True when the request is functionally a solo room — either flagged
 * is_solo, or the creator and requester resolve to the same user/name.
 * Use this to short-circuit reminders, retros, and "with both of you"
 * email copy that don't make sense on a solo workspace.
 */
export function isEffectivelySolo(args: {
  isSolo: boolean;
  creatorUserId?: string | null;
  requesterUserId?: string | null;
  creatorName?: string | null;
  requesterName?: string | null;
}): boolean {
  if (args.isSolo) return true;
  if (
    args.creatorUserId &&
    args.requesterUserId &&
    args.creatorUserId === args.requesterUserId
  ) {
    return true;
  }
  const c = clean(args.creatorName);
  const r = clean(args.requesterName);
  if (c && r && c.toLowerCase() === r.toLowerCase()) return true;
  return false;
}
