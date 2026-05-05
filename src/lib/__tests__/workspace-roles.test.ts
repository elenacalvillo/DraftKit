import { describe, expect, it } from "vitest";
import {
  getMessagePartnerLabel,
  isInvitedCollaborator,
} from "../workspace-roles";

describe("isInvitedCollaborator", () => {
  it("is true when the current user appears in the collaborators list", () => {
    const collabs = [{ user_id: "u-other" }, { user_id: "u-me" }];
    expect(isInvitedCollaborator("u-me", collabs)).toBe(true);
  });

  it("is false when the user is not in the list", () => {
    const collabs = [{ user_id: "u-other" }, { user_id: "u-someone" }];
    expect(isInvitedCollaborator("u-me", collabs)).toBe(false);
  });

  it("ignores email-only invites that haven't linked to a user_id yet", () => {
    const collabs = [{ user_id: null }, { user_id: null }];
    expect(isInvitedCollaborator("u-me", collabs)).toBe(false);
  });

  it("returns false when userId is missing or list is empty/null", () => {
    expect(isInvitedCollaborator(null, [{ user_id: "u-me" }])).toBe(false);
    expect(isInvitedCollaborator(undefined, [{ user_id: "u-me" }])).toBe(false);
    expect(isInvitedCollaborator("u-me", [])).toBe(false);
    expect(isInvitedCollaborator("u-me", null)).toBe(false);
    expect(isInvitedCollaborator("u-me", undefined)).toBe(false);
  });
});

describe("getMessagePartnerLabel", () => {
  it("uses the partner's first name when available", () => {
    expect(getMessagePartnerLabel("Sarah Smith")).toBe("Message Sarah");
    expect(getMessagePartnerLabel("Ada")).toBe("Message Ada");
  });

  it("ignores extra whitespace between name parts", () => {
    expect(getMessagePartnerLabel("   Sarah    Anne ")).toBe("Message Sarah");
  });

  it("falls back to 'Message Partner' when the partner has no name", () => {
    expect(getMessagePartnerLabel(null)).toBe("Message Partner");
    expect(getMessagePartnerLabel(undefined)).toBe("Message Partner");
    expect(getMessagePartnerLabel("")).toBe("Message Partner");
    expect(getMessagePartnerLabel("   ")).toBe("Message Partner");
  });
});
