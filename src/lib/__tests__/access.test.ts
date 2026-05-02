import { describe, expect, it } from "vitest";
import {
  ACTIVE_PROJECT_LIMIT,
  ACTIVE_PROJECT_LIMIT_MESSAGE,
  CHAPTER_STATUSES,
  MAX_IMAGE_BYTES,
  PROJECT_MEMBER_ROLES,
  STORAGE_CAP_BYTES,
  STORAGE_CAP_REACHED_MESSAGE,
  canCreateAnotherProject,
  canUploadImage,
  formatStorageUsage,
  hasProAccess,
  hasProjectAccess,
  isAcceptedImageMime,
  isValidChapterTransition,
  normalizeTier,
  roleLabel,
} from "../access";

describe("access constants", () => {
  it("encodes the documented public limits", () => {
    expect(ACTIVE_PROJECT_LIMIT).toBe(3);
    expect(STORAGE_CAP_BYTES).toBe(1_073_741_824);
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(PROJECT_MEMBER_ROLES).toEqual([
      "admin",
      "chapter_writer",
      "peer_reviewer",
      "cross_chapter_reviewer",
    ]);
    expect(CHAPTER_STATUSES).toEqual([
      "Draft",
      "Peer Review",
      "Editorial",
      "Final",
    ]);
  });

  it("uses the exact ticket copy strings", () => {
    expect(ACTIVE_PROJECT_LIMIT_MESSAGE).toBe(
      "You have 3 active projects. Archive one to create a new project, or upgrade for unlimited projects.",
    );
    expect(STORAGE_CAP_REACHED_MESSAGE).toBe(
      "You've reached your 1GB storage limit. Delete unused images to free up space.",
    );
  });
});

describe("normalizeTier", () => {
  it("recognizes pro and project", () => {
    expect(normalizeTier("pro")).toBe("pro");
    expect(normalizeTier("project")).toBe("project");
  });

  it("falls back to free for anything else", () => {
    expect(normalizeTier(null)).toBe("free");
    expect(normalizeTier(undefined)).toBe("free");
    expect(normalizeTier("free")).toBe("free");
    expect(normalizeTier("garbage")).toBe("free");
  });
});

describe("hasProAccess", () => {
  it("is false for null/undefined and free tier", () => {
    expect(hasProAccess(null)).toBe(false);
    expect(hasProAccess(undefined)).toBe(false);
    expect(hasProAccess({ subscription_tier: "free" })).toBe(false);
  });

  it("is true for both pro and project tiers (project is a superset)", () => {
    expect(hasProAccess({ subscription_tier: "pro" })).toBe(true);
    expect(hasProAccess({ subscription_tier: "project" })).toBe(true);
  });

  it("is false when trial_ends_at is in the past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(hasProAccess({ subscription_tier: "pro", trial_ends_at: past })).toBe(
      false,
    );
  });

  it("is true when trial_ends_at is in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      hasProAccess({ subscription_tier: "project", trial_ends_at: future }),
    ).toBe(true);
  });
});

describe("hasProjectAccess", () => {
  it("only passes for the project tier", () => {
    expect(hasProjectAccess({ subscription_tier: "free" })).toBe(false);
    expect(hasProjectAccess({ subscription_tier: "pro" })).toBe(false);
    expect(hasProjectAccess({ subscription_tier: "project" })).toBe(true);
  });

  it("is false for null/undefined", () => {
    expect(hasProjectAccess(null)).toBe(false);
    expect(hasProjectAccess(undefined)).toBe(false);
  });

  it("respects an expired trial", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(
      hasProjectAccess({ subscription_tier: "project", trial_ends_at: past }),
    ).toBe(false);
  });
});

describe("project limits", () => {
  it("allows creation while under the active limit", () => {
    expect(canCreateAnotherProject(0)).toBe(true);
    expect(canCreateAnotherProject(2)).toBe(true);
  });

  it("blocks at exactly the active limit", () => {
    expect(canCreateAnotherProject(3)).toBe(false);
    expect(canCreateAnotherProject(7)).toBe(false);
  });
});

describe("image upload helpers", () => {
  it("only accepts the documented mime types", () => {
    expect(isAcceptedImageMime("image/jpeg")).toBe(true);
    expect(isAcceptedImageMime("image/png")).toBe(true);
    expect(isAcceptedImageMime("image/webp")).toBe(true);
    expect(isAcceptedImageMime("image/gif")).toBe(true);
    expect(isAcceptedImageMime("image/heic")).toBe(false);
    expect(isAcceptedImageMime("application/pdf")).toBe(false);
  });

  it("blocks an upload that would exceed the storage cap", () => {
    expect(canUploadImage(0, MAX_IMAGE_BYTES)).toBe(true);
    expect(canUploadImage(STORAGE_CAP_BYTES, 1)).toBe(false);
    expect(canUploadImage(STORAGE_CAP_BYTES - 5, 5)).toBe(true);
    expect(canUploadImage(STORAGE_CAP_BYTES - 5, 6)).toBe(false);
  });

  it("formats storage usage with human-readable units", () => {
    expect(formatStorageUsage(0)).toBe("0.0 MB of 1GB used");
    expect(formatStorageUsage(50 * 1024 * 1024)).toBe("50.0 MB of 1GB used");
    expect(formatStorageUsage(1024 * 1024 * 1024)).toBe("1.00 GB of 1GB used");
  });
});

describe("chapter lifecycle", () => {
  it("allows any forward or backward transition between distinct statuses", () => {
    expect(isValidChapterTransition("Draft", "Peer Review")).toBe(true);
    expect(isValidChapterTransition("Peer Review", "Editorial")).toBe(true);
    expect(isValidChapterTransition("Editorial", "Final")).toBe(true);
    // Backward transition (admin can revert with confirmation)
    expect(isValidChapterTransition("Final", "Editorial")).toBe(true);
  });

  it("rejects no-op transitions", () => {
    expect(isValidChapterTransition("Draft", "Draft")).toBe(false);
  });
});

describe("role labels", () => {
  it("returns a friendly label for each role", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("chapter_writer")).toBe("Chapter Writer");
    expect(roleLabel("peer_reviewer")).toBe("Peer Reviewer");
    expect(roleLabel("cross_chapter_reviewer")).toBe("Cross-chapter Reviewer");
  });

  it("falls back to the raw value for unknown roles", () => {
    expect(roleLabel("custom" as unknown as "admin")).toBe("custom");
  });
});
