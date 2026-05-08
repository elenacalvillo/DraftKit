import { describe, expect, it } from "vitest";
import {
  MIN_NOTICE_WEEKS_DEFAULT,
  MIN_NOTICE_WEEKS_MAX,
  MIN_NOTICE_WEEKS_MIN,
  clampMinimumNoticeWeeks,
  filterDatesByMinimumNotice,
  getCreatorFirstName,
  getMinimumNoticeCutoff,
  getMinimumNoticeGuestLabel,
  isWithinMinimumNotice,
} from "../minimum-notice";

const REFERENCE = new Date(2026, 4, 8); // 2026-05-08, matches today

const dateToYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

describe("DRAFT-001: minimum notice constants", () => {
  it("documents the supported range and the safe default", () => {
    expect(MIN_NOTICE_WEEKS_MIN).toBe(0);
    expect(MIN_NOTICE_WEEKS_MAX).toBe(12);
    expect(MIN_NOTICE_WEEKS_DEFAULT).toBe(0);
  });
});

describe("clampMinimumNoticeWeeks", () => {
  it("returns the default for non-numeric or undefined values", () => {
    expect(clampMinimumNoticeWeeks(undefined)).toBe(0);
    expect(clampMinimumNoticeWeeks(null)).toBe(0);
    expect(clampMinimumNoticeWeeks("garbage")).toBe(0);
    expect(clampMinimumNoticeWeeks(NaN)).toBe(0);
    expect(clampMinimumNoticeWeeks(Infinity)).toBe(0);
  });

  it("clamps to the supported range", () => {
    expect(clampMinimumNoticeWeeks(-3)).toBe(0);
    expect(clampMinimumNoticeWeeks(99)).toBe(12);
    expect(clampMinimumNoticeWeeks(13)).toBe(12);
  });

  it("rounds to the nearest whole week", () => {
    expect(clampMinimumNoticeWeeks(2.4)).toBe(2);
    expect(clampMinimumNoticeWeeks(2.6)).toBe(3);
    expect(clampMinimumNoticeWeeks("4")).toBe(4);
  });
});

describe("getMinimumNoticeCutoff", () => {
  it("returns today's start-of-day when weeks is 0", () => {
    const cutoff = getMinimumNoticeCutoff(0, REFERENCE);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(4);
    expect(cutoff.getDate()).toBe(8);
    expect(cutoff.getHours()).toBe(0);
  });

  it("advances by N * 7 days from start-of-day for positive weeks", () => {
    const cutoff = getMinimumNoticeCutoff(2, REFERENCE);
    expect(dateToYmd(cutoff)).toBe("2026-05-22");
  });
});

describe("isWithinMinimumNotice", () => {
  it("returns false when buffer is 0 or unset", () => {
    expect(isWithinMinimumNotice("2026-05-09", 0, REFERENCE)).toBe(false);
    expect(isWithinMinimumNotice("2026-05-09", -1 as unknown as number, REFERENCE)).toBe(
      false,
    );
  });

  it("flags dates strictly inside the buffer window", () => {
    // 2-week buffer => dates before 2026-05-22 are blocked.
    expect(isWithinMinimumNotice("2026-05-08", 2, REFERENCE)).toBe(true);
    expect(isWithinMinimumNotice("2026-05-21", 2, REFERENCE)).toBe(true);
    expect(isWithinMinimumNotice("2026-05-22", 2, REFERENCE)).toBe(false);
    expect(isWithinMinimumNotice("2026-06-01", 2, REFERENCE)).toBe(false);
  });

  it("rejects malformed date strings safely", () => {
    expect(isWithinMinimumNotice("", 2, REFERENCE)).toBe(false);
    expect(isWithinMinimumNotice("not-a-date", 2, REFERENCE)).toBe(false);
  });
});

describe("filterDatesByMinimumNotice", () => {
  it("returns the input untouched when buffer is 0 (preserves existing behaviour)", () => {
    const dates = ["2026-05-09", "2026-06-01", "2026-07-01"];
    expect(filterDatesByMinimumNotice(dates, 0, REFERENCE)).toEqual(dates);
  });

  it("drops dates inside the buffer but keeps everything past the cutoff", () => {
    const dates = ["2026-05-09", "2026-05-21", "2026-05-22", "2026-06-01"];
    expect(filterDatesByMinimumNotice(dates, 2, REFERENCE)).toEqual([
      "2026-05-22",
      "2026-06-01",
    ]);
  });
});

describe("getMinimumNoticeGuestLabel", () => {
  it("returns null when there is no buffer (no '0 weeks' nag)", () => {
    expect(getMinimumNoticeGuestLabel(0, "Elena")).toBeNull();
    expect(getMinimumNoticeGuestLabel(-3, "Elena")).toBeNull();
  });

  it("uses the matching ticket copy with the creator's first name", () => {
    expect(getMinimumNoticeGuestLabel(2, "Elena")).toBe(
      "Elena typically needs 2 weeks from content deadline to publication.",
    );
  });

  it("singularises 1 week", () => {
    expect(getMinimumNoticeGuestLabel(1, "Elena")).toBe(
      "Elena typically needs 1 week from content deadline to publication.",
    );
  });

  it("falls back to a generic noun when no name is available", () => {
    expect(getMinimumNoticeGuestLabel(3, null)).toBe(
      "This creator typically needs 3 weeks from content deadline to publication.",
    );
  });
});

describe("getCreatorFirstName", () => {
  it("returns just the first whitespace-separated token", () => {
    expect(getCreatorFirstName("Elena Verna")).toBe("Elena");
    expect(getCreatorFirstName("  Karen  Smiley  ")).toBe("Karen");
  });

  it("falls back gracefully for empty input", () => {
    expect(getCreatorFirstName("")).toBeNull();
    expect(getCreatorFirstName("   ")).toBeNull();
    expect(getCreatorFirstName(null)).toBeNull();
    expect(getCreatorFirstName(undefined)).toBeNull();
  });

  it("returns the full name when there is only one token", () => {
    expect(getCreatorFirstName("Elena")).toBe("Elena");
  });
});
