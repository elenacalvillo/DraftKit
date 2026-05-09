import { describe, it, expect } from "vitest";
import { resolveRange, recentWeekOptions, recentMonthOptions, isoWeek } from "../analytics-range";

const NOW = new Date("2026-05-09T12:00:00.000Z"); // Saturday

describe("analytics-range", () => {
  it("last-7d resolves to a 7-day window with a 7-day prev", () => {
    const r = resolveRange("last-7d", NOW);
    expect(new Date(r.end).getTime() - new Date(r.start).getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(new Date(r.prevEnd).getTime()).toBe(new Date(r.start).getTime());
    expect(new Date(r.start).getTime() - new Date(r.prevStart).getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(r.label).toBe("Last 7 days");
    expect(r.prevLabel).toBe("vs prev 7d");
  });

  it("last-30d resolves to 30 days with day buckets", () => {
    const r = resolveRange("last-30d", NOW);
    expect(r.bucket).toBe("day");
    expect(r.bucketCount).toBe(30);
  });

  it("falls back to last-7d for unknown keys", () => {
    const r = resolveRange("garbage", NOW);
    expect(r.label).toBe("Last 7 days");
  });

  it("week-YYYY-Www round-trips", () => {
    const r = resolveRange("week-2026-W19", NOW);
    expect(r.label).toMatch(/Week of/);
    // Span is exactly 7 days
    expect(new Date(r.end).getTime() - new Date(r.start).getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("month-YYYY-MM resolves to month boundaries", () => {
    const r = resolveRange("month-2026-04", NOW);
    expect(r.label).toBe("April 2026");
    const start = new Date(r.start);
    const end = new Date(r.end);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(4);
    expect(end.getDate()).toBe(1);
  });

  it("custom range parses YYYYMMDD-YYYYMMDD", () => {
    const r = resolveRange("custom-20260401-20260407", NOW);
    expect(new Date(r.start).getDate()).toBe(1);
    // end is exclusive (Apr 8 00:00)
    expect(new Date(r.end).getDate()).toBe(8);
  });

  it("recentWeekOptions returns N descending weeks", () => {
    const opts = recentWeekOptions(4, NOW);
    expect(opts).toHaveLength(4);
    expect(opts[0].key).toMatch(/^week-\d{4}-W\d{2}$/);
  });

  it("recentMonthOptions returns N descending months", () => {
    const opts = recentMonthOptions(3, NOW);
    expect(opts).toHaveLength(3);
    expect(opts[0].label).toBe("May 2026");
    expect(opts[1].label).toBe("April 2026");
  });

  it("isoWeek matches ISO 8601", () => {
    expect(isoWeek(new Date("2026-01-05T00:00:00Z"))).toEqual({ year: 2026, week: 2 });
  });

  it("range >90d switches to weekly buckets", () => {
    const r = resolveRange("custom-20260101-20260501", NOW);
    expect(r.bucket).toBe("week");
  });
});
