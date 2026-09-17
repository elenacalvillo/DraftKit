import { describe, expect, it } from "vitest";
import {
  MAX_COLLAB_GUIDELINES_LENGTH,
  collabGuidelinesSchema,
  reminderDaysSchema,
} from "../validations";

describe("collaboration guidelines validation", () => {
  it("accepts Dinah's 2,482-character playbook", () => {
    expect(collabGuidelinesSchema.safeParse("a".repeat(2482)).success).toBe(true);
  });

  it("accepts the maximum length and rejects anything longer", () => {
    expect(
      collabGuidelinesSchema.safeParse("a".repeat(MAX_COLLAB_GUIDELINES_LENGTH)).success,
    ).toBe(true);

    const result = collabGuidelinesSchema.safeParse(
      "a".repeat(MAX_COLLAB_GUIDELINES_LENGTH + 1),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        `Guidelines must be ${MAX_COLLAB_GUIDELINES_LENGTH.toLocaleString()} characters or fewer`,
      );
    }
  });
});

describe("collaboration reminder validation", () => {
  it("accepts a 14-day reminder", () => {
    expect(reminderDaysSchema.safeParse(14).success).toBe(true);
  });

  it("rejects reminders beyond 14 days", () => {
    expect(reminderDaysSchema.safeParse(15).success).toBe(false);
  });
});