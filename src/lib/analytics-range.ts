/**
 * Time-range helpers for the Admin Analytics page.
 *
 * A "range key" is a stable string that round-trips through the URL
 * (`?range=...`) and resolves to a concrete `{ start, end }` window plus
 * the equivalent previous window for delta comparisons.
 *
 * Supported keys:
 *   - "last-7d"            (rolling, default)
 *   - "last-30d"           (rolling)
 *   - "this-week"          (Mon..now, ISO weeks)
 *   - "this-month"         (1st..now)
 *   - "week-YYYY-Www"      e.g. "week-2026-W19"
 *   - "month-YYYY-MM"      e.g. "month-2026-04"
 *   - "custom-YYYYMMDD-YYYYMMDD"
 */

export type RangeKey = string;

export interface ResolvedRange {
  /** Inclusive start (ISO timestamp). */
  start: string;
  /** Exclusive end (ISO timestamp). */
  end: string;
  /** Equivalent previous-period window for deltas. */
  prevStart: string;
  prevEnd: string;
  /** Human label, e.g. "Last 7 days", "Week of May 4 – May 10", "April 2026". */
  label: string;
  /** Short label for delta annotation, e.g. "vs prev 7d". */
  prevLabel: string;
  /** Bucket size for daily-events chart. */
  bucket: "day" | "week";
  /** Number of buckets in the range (used to seed the daily chart). */
  bucketCount: number;
}

const MS_DAY = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** ISO week: Monday as start of week. Returns { year, week } per ISO 8601. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / MS_DAY + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** Monday 00:00 of the ISO week containing `date` (local time). */
function startOfIsoWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay() || 7; // Sun=0 -> 7
  d.setDate(d.getDate() - (day - 1));
  return d;
}

/** First date (Monday) of ISO week `week` of `year`. */
function dateOfIsoWeek(year: number, week: number): Date {
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const start = startOfIsoWeek(jan4);
  start.setDate(start.getDate() + (week - 1) * 7);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function fmtMonthDay(d: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function fmtMonthYear(d: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function parseCustom(key: string): { start: Date; end: Date } | null {
  const m = key.match(/^custom-(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y1, m1, d1, y2, m2, d2] = m;
  const start = new Date(Number(y1), Number(m1) - 1, Number(d1), 0, 0, 0, 0);
  const end = new Date(Number(y2), Number(m2) - 1, Number(d2), 0, 0, 0, 0);
  end.setDate(end.getDate() + 1); // exclusive
  return { start, end };
}

/** Resolve a range key against `now`. `now` is injectable for tests. */
export function resolveRange(key: RangeKey, now: Date = new Date()): ResolvedRange {
  let start: Date;
  let end: Date;
  let label: string;
  let prevLabel: string;
  let bucket: "day" | "week" = "day";

  if (key === "last-7d" || !key) {
    end = new Date(now);
    start = new Date(now.getTime() - 7 * MS_DAY);
    label = "Last 7 days";
    prevLabel = "vs prev 7d";
  } else if (key === "last-30d") {
    end = new Date(now);
    start = new Date(now.getTime() - 30 * MS_DAY);
    label = "Last 30 days";
    prevLabel = "vs prev 30d";
  } else if (key === "this-week") {
    start = startOfIsoWeek(now);
    end = new Date(now);
    label = "This week";
    prevLabel = "vs last week";
  } else if (key === "this-month") {
    start = startOfMonth(now);
    end = new Date(now);
    label = "This month";
    prevLabel = "vs last month";
  } else if (key.startsWith("week-")) {
    const m = key.match(/^week-(\d{4})-W(\d{1,2})$/);
    if (!m) throw new Error(`Invalid week key: ${key}`);
    const year = Number(m[1]);
    const week = Number(m[2]);
    start = dateOfIsoWeek(year, week);
    end = new Date(start.getTime() + 7 * MS_DAY);
    const last = new Date(end.getTime() - MS_DAY);
    label = `Week of ${fmtMonthDay(start)} – ${fmtMonthDay(last)}`;
    prevLabel = "vs prev week";
  } else if (key.startsWith("month-")) {
    const m = key.match(/^month-(\d{4})-(\d{2})$/);
    if (!m) throw new Error(`Invalid month key: ${key}`);
    const year = Number(m[1]);
    const monthIdx = Number(m[2]) - 1;
    start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
    end = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
    label = fmtMonthYear(start);
    prevLabel = "vs prev month";
  } else if (key.startsWith("custom-")) {
    const parsed = parseCustom(key);
    if (!parsed) throw new Error(`Invalid custom key: ${key}`);
    start = parsed.start;
    end = parsed.end;
    label = `${fmtMonthDay(start)} – ${fmtMonthDay(new Date(end.getTime() - MS_DAY))}`;
    prevLabel = "vs prev period";
  } else {
    // Fallback to last 7d
    return resolveRange("last-7d", now);
  }

  const durationMs = end.getTime() - start.getTime();
  const prevEnd = start;
  const prevStart = new Date(start.getTime() - durationMs);

  const days = Math.max(1, Math.round(durationMs / MS_DAY));
  if (days > 90) bucket = "week";
  const bucketCount = bucket === "day" ? days : Math.ceil(days / 7);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
    label,
    prevLabel,
    bucket,
    bucketCount,
  };
}

/** Build a list of recent week keys (most recent first), going back N weeks from `now`. */
export function recentWeekOptions(n: number, now: Date = new Date()): { key: RangeKey; label: string }[] {
  const out: { key: RangeKey; label: string }[] = [];
  const monday = startOfIsoWeek(now);
  for (let i = 0; i < n; i++) {
    const d = new Date(monday.getTime() - i * 7 * MS_DAY);
    const { year, week } = isoWeek(d);
    const last = new Date(d.getTime() + 6 * MS_DAY);
    out.push({
      key: `week-${year}-W${pad(week)}`,
      label: `Week of ${fmtMonthDay(d)} – ${fmtMonthDay(last)}`,
    });
  }
  return out;
}

/** Build a list of recent month keys (most recent first). */
export function recentMonthOptions(n: number, now: Date = new Date()): { key: RangeKey; label: string }[] {
  const out: { key: RangeKey; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `month-${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: fmtMonthYear(d),
    });
  }
  return out;
}

/** Bucket label for daily-events chart x-axis. */
export function bucketLabel(d: Date, bucket: "day" | "week"): string {
  if (bucket === "week") {
    const last = new Date(d.getTime() + 6 * MS_DAY);
    return `${fmtMonthDay(d)}`;
  }
  return fmtMonthDay(d);
}
