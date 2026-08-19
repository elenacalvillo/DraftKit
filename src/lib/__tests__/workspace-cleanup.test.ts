// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { findDuplicateTitle, normalizeWorkspaceTitle } from "../workspace-cleanup";

describe("normalizeWorkspaceTitle", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeWorkspaceTitle("  Capítulo   6c  ")).toBe("capítulo 6c");
  });

  it("handles null and empty input", () => {
    expect(normalizeWorkspaceTitle(null)).toBe("");
    expect(normalizeWorkspaceTitle(undefined)).toBe("");
  });
});

describe("findDuplicateTitle", () => {
  const existing = [
    { id: "a", title: "La Laguna" },
    { id: "b", title: "Chapter Two" },
    { id: "c", title: null },
  ];

  it("matches case and whitespace insensitively", () => {
    expect(findDuplicateTitle("  la   laguna ", existing)?.id).toBe("a");
  });

  it("returns null when nothing matches", () => {
    expect(findDuplicateTitle("New chapter", existing)).toBeNull();
  });

  it("never matches on an empty title", () => {
    expect(findDuplicateTitle("   ", existing)).toBeNull();
  });
});
