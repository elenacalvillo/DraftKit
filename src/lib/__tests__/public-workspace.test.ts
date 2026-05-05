import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITE_MESSAGE,
  INVITE_MESSAGE_SOFT_LIMIT,
  getInviteCtaLabel,
  getInviteMessage,
  getInviterInitials,
} from "../public-workspace";

describe("getInviteMessage", () => {
  it("returns the trimmed message when one is provided", () => {
    expect(getInviteMessage("  Take a look at the intro  ")).toBe(
      "Take a look at the intro",
    );
  });

  it("falls back to the DRAFT-003 default when invite_message is null", () => {
    expect(getInviteMessage(null)).toBe(DEFAULT_INVITE_MESSAGE);
  });

  it("falls back to the default when invite_message is undefined", () => {
    expect(getInviteMessage(undefined)).toBe(DEFAULT_INVITE_MESSAGE);
  });

  it("falls back to the default for whitespace-only strings", () => {
    expect(getInviteMessage("   \n\t  ")).toBe(DEFAULT_INVITE_MESSAGE);
  });

  it("uses the exact ticket fallback copy", () => {
    expect(DEFAULT_INVITE_MESSAGE).toBe("Review the draft and share your thoughts");
  });
});

describe("getInviterInitials", () => {
  it("returns up to two uppercase initials", () => {
    expect(getInviterInitials("Sarah Smith")).toBe("SS");
    expect(getInviterInitials("ada lovelace")).toBe("AL");
  });

  it("supports single-word names", () => {
    expect(getInviterInitials("Madonna")).toBe("M");
  });

  it("collapses extra whitespace between parts", () => {
    expect(getInviterInitials("  Sarah   Anne   Smith  ")).toBe("SA");
  });

  it("returns ? when name is null/undefined/empty", () => {
    expect(getInviterInitials(null)).toBe("?");
    expect(getInviterInitials(undefined)).toBe("?");
    expect(getInviterInitials("")).toBe("?");
    expect(getInviterInitials("   ")).toBe("?");
  });
});

describe("getInviteCtaLabel", () => {
  it("uses the creator's first name when available — replacing the old 'Enter Writer's Room' copy", () => {
    expect(getInviteCtaLabel("Sarah Smith")).toBe("Review Sarah's Draft");
    expect(getInviteCtaLabel("Madonna")).toBe("Review Madonna's Draft");
  });

  it("falls back to a generic action-oriented label when name is missing", () => {
    expect(getInviteCtaLabel(null)).toBe("Open Collaboration");
    expect(getInviteCtaLabel(undefined)).toBe("Open Collaboration");
    expect(getInviteCtaLabel("")).toBe("Open Collaboration");
    expect(getInviteCtaLabel("   ")).toBe("Open Collaboration");
  });

  it("never returns the deprecated 'Enter Writer's Room' label", () => {
    expect(getInviteCtaLabel("Anyone")).not.toMatch(/Writer'?s Room/);
    expect(getInviteCtaLabel(null)).not.toMatch(/Writer'?s Room/);
  });
});

describe("INVITE_MESSAGE_SOFT_LIMIT", () => {
  it("is 280 chars, matching the modal counter contract", () => {
    expect(INVITE_MESSAGE_SOFT_LIMIT).toBe(280);
  });
});
