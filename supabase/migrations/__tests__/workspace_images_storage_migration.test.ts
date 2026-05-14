import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "..",
  "20260514120000_workspace_images_storage.sql",
);

const sql = readFileSync(migrationPath, "utf8");

/**
 * Workspace inline images (DRAFT-001 of the inline-images story).
 *
 * The contract these tests pin down is the storage-layer side of the
 * "writers can insert images into the draft" feature:
 *
 *   - A `workspace-images` bucket exists with the documented mime
 *     whitelist and size limit.
 *   - The bucket is PUBLIC so the URL written into shared_content can
 *     render anywhere (including the anonymous public sheet).
 *   - Write/update/delete are gated by `public.has_workspace_access`,
 *     i.e. ANY authenticated workspace participant can upload —
 *     intentionally NOT restricted to project owners (which would
 *     limit the feature to Pro/Project tiers).
 */
describe("workspace_images storage migration", () => {
  it("creates a workspace-images bucket with the documented size + mime constraints", () => {
    expect(sql).toMatch(/INSERT INTO storage\.buckets/);
    expect(sql).toMatch(/'workspace-images',\s*'workspace-images'/);
    // 10 MB ceiling on the bucket as defence-in-depth around the
    // client's 1 MB compression target.
    expect(sql).toMatch(/10485760/);
    expect(sql).toMatch(/image\/jpeg/);
    expect(sql).toMatch(/image\/png/);
    expect(sql).toMatch(/image\/webp/);
    expect(sql).toMatch(/image\/gif/);
  });

  it("marks the bucket PUBLIC so getPublicUrl() returns a renderable https:// URL", () => {
    // The third argument to INSERT INTO storage.buckets is the public
    // flag. We can't easily parse the positional argument, but the
    // ON CONFLICT clause makes the intent explicit.
    expect(sql).toMatch(/public = EXCLUDED\.public/);
    // Asserting on the literal VALUES tuple — `\s` is necessary
    // because the migration formats one column per line.
    expect(sql).toMatch(
      /'workspace-images',\s*'workspace-images',\s*true,/,
    );
  });

  it("authorises writes via has_workspace_access (NOT is_project_owner)", () => {
    // Using has_workspace_access is what makes this feature available
    // to free + Pro alike — the project-images bucket uses
    // is_project_owner, which would gate this behind the Project tier.
    expect(sql).toMatch(/has_workspace_access\(\s*auth\.uid\(\)/);
    expect(sql).not.toMatch(/is_project_owner/);
  });

  it("uses the first folder of the object name as the request_id", () => {
    // RLS authorisation depends on the bucket path being
    // `{request_id}/{filename}`. The path utility in
    // src/lib/workspace-images.ts must keep producing this layout.
    expect(sql).toMatch(/storage\.foldername\(name\)\)\[1\]::uuid/);
  });

  it("declares INSERT, UPDATE, and DELETE policies for participants", () => {
    expect(sql).toMatch(/FOR INSERT/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/FOR DELETE/);
  });

  it("scopes every policy to the workspace-images bucket so other buckets are unaffected", () => {
    // Crude but effective: every CREATE POLICY in this file must
    // include a bucket_id check.
    const policyBlocks = sql.split(/CREATE POLICY/).slice(1);
    expect(policyBlocks.length).toBeGreaterThan(0);
    for (const block of policyBlocks) {
      expect(block).toMatch(/bucket_id = 'workspace-images'/);
    }
  });
});
