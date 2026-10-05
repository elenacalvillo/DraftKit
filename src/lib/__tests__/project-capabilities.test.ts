import { describe, expect, it } from "vitest";
import { projectCapabilities, type ProjectCapabilities } from "../access";

type Row = [keyof ProjectCapabilities, boolean, boolean, boolean, boolean, boolean];

// Columns: owner, admin, cross_chapter_reviewer, peer_reviewer, chapter_writer
const MATRIX: Row[] = [
  ["seeAllChapters", true, true, true, false, false],
  ["manageChapters", true, true, false, false, false],
  ["deleteChapters", true, false, false, false, false],
  ["moveChapters", true, false, false, false, false],
  ["archive", true, false, false, false, false],
  ["editDetails", true, true, false, false, false],
  ["editCover", true, false, false, false, false],
  ["exportBook", true, true, true, false, false],
  ["manageMembers", true, true, false, false, false],
  ["broadcast", true, true, false, false, false],
  ["viewMembers", true, true, true, true, true],
  ["viewBroadcasts", true, true, true, true, true],
];

const ROLES = [
  "owner",
  "admin",
  "cross_chapter_reviewer",
  "peer_reviewer",
  "chapter_writer",
] as const;

describe("projectCapabilities matrix", () => {
  for (const [cap, ...expected] of MATRIX) {
    ROLES.forEach((role, i) => {
      it(`${role} ${expected[i] ? "can" : "cannot"} ${cap}`, () => {
        expect(projectCapabilities(role)[cap]).toBe(expected[i]);
      });
    });
  }

  it("grants nothing to non-members", () => {
    for (const role of [null, undefined, "", "guest", "random"]) {
      const caps = projectCapabilities(role);
      expect(Object.values(caps).every((v) => v === false)).toBe(true);
    }
  });
});
