import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "..",
  "20260508120000_minimum_notice_and_external_links.sql",
);

const sql = readFileSync(migrationPath, "utf8");

/**
 * DRAFT-001 + DRAFT-002 — Schema contract for the minimum-notice buffer
 * and external-links payload that the front-end relies on.
 */
describe("DRAFT-001/002 migration", () => {
  it("adds availability.minimum_notice_weeks as NOT NULL DEFAULT 0", () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS minimum_notice_weeks integer NOT NULL DEFAULT 0/i,
    );
  });

  it("constrains minimum_notice_weeks to the 0..12 range", () => {
    expect(sql).toMatch(/availability_minimum_notice_weeks_range/);
    expect(sql).toMatch(/minimum_notice_weeks >= 0/);
    expect(sql).toMatch(/minimum_notice_weeks <= 12/);
  });

  it("adds creators.external_links as a NOT NULL jsonb defaulting to []", () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS external_links jsonb NOT NULL DEFAULT '\[\]'::jsonb/i,
    );
  });

  it("does NOT drop the deprecated collab_mode column (DRAFT-003 keeps it)", () => {
    expect(sql).not.toMatch(/DROP COLUMN .*collab_mode/i);
  });

  it("republishes public_creator_profiles with external_links", () => {
    expect(sql).toMatch(/CREATE VIEW public\.public_creator_profiles/);
    expect(sql).toMatch(/external_links/);
    expect(sql).toMatch(
      /GRANT SELECT ON public\.public_creator_profiles TO anon, authenticated/,
    );
  });

  it("recreates the availability RLS policy that depends on the view", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Public can view availability for public creators"/,
    );
    expect(sql).toMatch(/public\.creator_has_public_profile\(creator_id\)/);
  });
});
