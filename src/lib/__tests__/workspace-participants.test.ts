import { describe, expect, it } from "vitest";
import {
  describeParticipants,
  getParticipantNames,
  isEffectivelySolo,
} from "../workspace-participants";

describe("describeParticipants — Karen-and-Karen regression", () => {
  it("renders solo workspaces as a single name with (solo) tag", () => {
    expect(
      describeParticipants({
        creatorName: "Karen Smiley",
        requesterName: "Karen Smiley",
        isSolo: true,
      }),
    ).toBe("Karen Smiley (solo)");
  });

  it("never duplicates the same name even when is_solo is false", () => {
    // Defensive: if a non-solo row somehow has matching names, still dedupe.
    expect(
      describeParticipants({
        creatorName: "Karen Smiley",
        requesterName: "karen smiley",
        isSolo: false,
      }),
    ).toBe("Karen Smiley");
  });

  it("renders duo collabs as 'A and B'", () => {
    expect(
      describeParticipants({
        creatorName: "Karen Smiley",
        requesterName: "Elena Calvillo",
        isSolo: false,
      }),
    ).toBe("Karen Smiley and Elena Calvillo");
  });

  it("merges extra collaborators on a solo workspace", () => {
    expect(
      describeParticipants({
        creatorName: "Karen Smiley",
        requesterName: "Karen Smiley",
        isSolo: true,
        collaboratorNames: ["Elena Calvillo"],
      }),
    ).toBe("Karen Smiley and Elena Calvillo");
  });

  it("uses Oxford-free 'A, B and C' for three", () => {
    expect(
      describeParticipants({
        creatorName: "Karen",
        requesterName: "Elena",
        isSolo: false,
        collaboratorNames: ["Tina"],
      }),
    ).toBe("Karen, Elena and Tina");
  });

  it("collapses 4+ to 'A, B and N others'", () => {
    expect(
      describeParticipants({
        creatorName: "Karen",
        requesterName: "Elena",
        isSolo: false,
        collaboratorNames: ["Tina", "Sam", "Jules"],
      }),
    ).toBe("Karen, Elena and 3 others");
  });

  it("returns empty string when nothing usable is provided", () => {
    expect(
      describeParticipants({
        creatorName: null,
        requesterName: "  ",
        isSolo: false,
      }),
    ).toBe("");
  });
});

describe("getParticipantNames", () => {
  it("excludes requester on solo rooms", () => {
    expect(
      getParticipantNames({
        creatorName: "Karen",
        requesterName: "Karen",
        isSolo: true,
      }),
    ).toEqual(["Karen"]);
  });

  it("dedupes case-insensitively across all sources", () => {
    expect(
      getParticipantNames({
        creatorName: "Karen Smiley",
        requesterName: "Elena",
        isSolo: false,
        collaboratorNames: ["elena", "ELENA  ", "Tina"],
      }),
    ).toEqual(["Karen Smiley", "Elena", "Tina"]);
  });
});

describe("isEffectivelySolo", () => {
  it("is true when is_solo flag is set", () => {
    expect(isEffectivelySolo({ isSolo: true })).toBe(true);
  });

  it("is true when creator_user_id === requester_user_id", () => {
    expect(
      isEffectivelySolo({
        isSolo: false,
        creatorUserId: "u-1",
        requesterUserId: "u-1",
      }),
    ).toBe(true);
  });

  it("is true when names match (defensive fallback)", () => {
    expect(
      isEffectivelySolo({
        isSolo: false,
        creatorName: "Karen Smiley",
        requesterName: "  karen smiley ",
      }),
    ).toBe(true);
  });

  it("is false for a normal duo collab", () => {
    expect(
      isEffectivelySolo({
        isSolo: false,
        creatorUserId: "u-1",
        requesterUserId: "u-2",
        creatorName: "Karen",
        requesterName: "Elena",
      }),
    ).toBe(false);
  });
});
