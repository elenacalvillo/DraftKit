import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "..",
  "20260505120000_invite_message_and_public_sheet.sql",
);

const sql = readFileSync(migrationPath, "utf8");

/**
 * DRAFT-002 — Pin down the data-layer contract that DRAFT-003 / 004 depend on:
 *   - invite_message added as nullable TEXT (no default).
 *   - get_public_sheet now returns invite_message + creator_profile_image_url
 *     in addition to its existing fields.
 *   - Function remains SECURITY DEFINER and grant-executable to anon + authenticated.
 */
describe("invite_message migration", () => {
  it("adds invite_message as a nullable text column with no default", () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS invite_message text;?/i,
    );
    // No DEFAULT clause on the new column — existing rows must stay NULL.
    expect(sql).not.toMatch(/invite_message\s+text[^;]*DEFAULT/i);
  });

  it("recreates get_public_sheet with the new return columns", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_public_sheet\(_token uuid\)/,
    );
    // New columns
    expect(sql).toMatch(/creator_profile_image_url text/);
    expect(sql).toMatch(/invite_message text/);
    // Plus all the existing return columns
    expect(sql).toMatch(/request_id uuid/);
    expect(sql).toMatch(/project_title text/);
    expect(sql).toMatch(/shared_content text/);
    expect(sql).toMatch(/creator_name text/);
    expect(sql).toMatch(/creator_username text/);
  });

  it("stays SECURITY DEFINER (no RLS change required)", () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("selects c.profile_image_url and cr.invite_message from the joined tables", () => {
    expect(sql).toMatch(/c\.profile_image_url\s+AS creator_profile_image_url/);
    expect(sql).toMatch(/cr\.invite_message\s+AS invite_message/);
  });

  it("re-grants EXECUTE to anon and authenticated", () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_public_sheet\(uuid\) TO anon, authenticated;?/,
    );
  });
});
