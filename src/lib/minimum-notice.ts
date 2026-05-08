/**
 * Minimum Notice Period (DRAFT-001)
 *
 * Lets a creator block off the next N weeks of selectable booking dates so
 * guests can only request publish dates the creator can realistically deliver
 * on. The buffer applies only to *future selectable* dates — already-booked
 * dates within the window remain visible as booked.
 */

export const MIN_NOTICE_WEEKS_MIN = 0;
export const MIN_NOTICE_WEEKS_MAX = 12;
export const MIN_NOTICE_WEEKS_DEFAULT = 0;

/**
 * Clamp/normalize an arbitrary user-provided value into the supported range.
 * Non-finite, negative, or out-of-range values fall back to 0 so we never
 * break an existing creator's calendar on release.
 */
export function clampMinimumNoticeWeeks(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MIN_NOTICE_WEEKS_DEFAULT;
  const rounded = Math.round(n);
  if (rounded < MIN_NOTICE_WEEKS_MIN) return MIN_NOTICE_WEEKS_MIN;
  if (rounded > MIN_NOTICE_WEEKS_MAX) return MIN_NOTICE_WEEKS_MAX;
  return rounded;
}

/**
 * Returns the cutoff date: any selectable date strictly before this date is
 * within the buffer window. We use start-of-day local time so that "today"
 * (which is week 0) is never the cutoff itself.
 *
 * @param weeks number of weeks of buffer (already clamped is fine)
 * @param now optional reference date (for tests)
 */
export function getMinimumNoticeCutoff(weeks: number, now: Date = new Date()): Date {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() + Math.max(0, Math.floor(weeks)) * 7);
  return cutoff;
}

/**
 * Decide whether a YYYY-MM-DD string falls inside the creator's buffer window.
 * Returns false when there is no buffer (so existing behaviour is preserved).
 */
export function isWithinMinimumNotice(
  dateStr: string,
  weeks: number,
  now: Date = new Date(),
): boolean {
  if (!dateStr || !weeks || weeks <= 0) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  const cutoff = getMinimumNoticeCutoff(weeks, now);
  return date < cutoff;
}

/**
 * Filter the `available_dates` array down to only the dates a guest is
 * actually allowed to pick — i.e. drop anything inside the buffer.
 *
 * Booked dates are NOT passed through this filter (they're rendered with the
 * "booked" status which is allowed even inside the buffer window).
 */
export function filterDatesByMinimumNotice(
  dates: string[],
  weeks: number,
  now: Date = new Date(),
): string[] {
  if (!weeks || weeks <= 0) return dates;
  return dates.filter((d) => !isWithinMinimumNotice(d, weeks, now));
}

/**
 * Plain-language label shown to guests on the public booking page. Returns
 * `null` when there is no buffer so the UI can omit the section entirely
 * instead of showing a confusing "0 weeks notice" message.
 */
export function getMinimumNoticeGuestLabel(
  weeks: number,
  creatorFirstName: string | null | undefined,
): string | null {
  if (!weeks || weeks <= 0) return null;
  const name = (creatorFirstName ?? "").trim() || "This creator";
  const weekWord = weeks === 1 ? "week" : "weeks";
  return `${name} typically needs ${weeks} ${weekWord} from content deadline to publication.`;
}

/**
 * Take a creator's display name and surface just the first name (or whatever
 * non-empty token comes first) for use in friendly copy. Falls back to the
 * full name when only one token is present.
 */
export function getCreatorFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}
