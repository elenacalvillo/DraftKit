import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "..",
  "20260519000000_create_creator_profile_rpc.sql",
);

const sql = readFileSync(migrationPath, "utf8");

/**
 * Atomic creator profile creation — the data-layer half of the
 * ghost-user fix. These tests pin the wire-level contract the
 * frontend depends on:
 *
 *   - A SECURITY DEFINER function named create_creator_profile
 *     exists with the camelCase-friendly underscore-prefixed args
 *     the frontend RPC helper sends.
 *   - The function performs both inserts in a single transaction
 *     (a PL/pgSQL function body trivially satisfies this, so
 *     more importantly, we make sure there is NO BEGIN/COMMIT
 *     pair that would split the transaction).
 *   - Orphan recovery: an existing creators row for the same
 *     auth user is reused, NOT collided-with.
 *   - Username collisions raise a typed error the frontend can
 *     route to the username field.
 *   - The function is invocable only by authenticated users
 *     (EXECUTE not granted to anon).
 */
describe("create_creator_profile RPC migration", () => {
  it("declares the function as SECURITY DEFINER with the public search_path", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.create_creator_profile/,
    );
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("accepts the underscore-prefixed args the frontend helper builds", () => {
    // These have to stay in sync with src/lib/creator-profile.ts's
    // buildRpcArgs(). If you rename one, rename the other.
    expect(sql).toMatch(/_username text/);
    expect(sql).toMatch(/_name text/);
    expect(sql).toMatch(/_email text/);
    expect(sql).toMatch(/_substack_url text DEFAULT NULL/);
    expect(sql).toMatch(/_newsletter_url text DEFAULT NULL/);
    expect(sql).toMatch(/_welcome_message text DEFAULT NULL/);
    expect(sql).toMatch(
      /_join_directory_waitlist boolean DEFAULT false/,
    );
    expect(sql).toMatch(/_profile_image_url text DEFAULT NULL/);
    expect(sql).toMatch(/_referred_by uuid DEFAULT NULL/);
  });

  it("inserts into BOTH creators and creator_contacts in the same function body", () => {
    // The atomicity guarantee — a single PL/pgSQL function body is
    // one implicit transaction, but a stray COMMIT or a savepoint
    // would break that. We pin the structural contract.
    expect(sql).toMatch(/INSERT INTO public\.creators/);
    expect(sql).toMatch(/INSERT INTO public\.creator_contacts/);
    expect(sql).not.toMatch(/\bCOMMIT\b/);
    expect(sql).not.toMatch(/\bROLLBACK\b/);
  });

  it("recovers from orphaned creators rows instead of colliding", () => {
    // The "retry after partial failure" acceptance criterion.
    expect(sql).toMatch(
      /SELECT c\.id INTO _existing_creator_id\s+FROM public\.creators c\s+WHERE c\.user_id = _uid/,
    );
    expect(sql).toMatch(/UPDATE public\.creators/);
  });

  it("raises a typed username_taken exception on collision", () => {
    // A bare unique_violation would leak as a generic Postgres
    // error message; the frontend tests rely on the typed prefix.
    expect(sql).toMatch(/'username_taken'/);
    expect(sql).toMatch(/ERRCODE = '23505'/);
  });

  it("uses ON CONFLICT on creator_contacts so the recovery path is race-safe", () => {
    expect(sql).toMatch(
      /INSERT INTO public\.creator_contacts[\s\S]*ON CONFLICT \(creator_id\) DO UPDATE/,
    );
  });

  it("revokes PUBLIC and grants EXECUTE to authenticated only", () => {
    // Anonymous callers MUST NOT be able to invoke this — the
    // function relies on auth.uid() being a real user. anon is
    // explicitly NOT in the grant list.
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.create_creator_profile/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.create_creator_profile[\s\S]*TO authenticated/,
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.create_creator_profile[\s\S]*TO anon/,
    );
  });

  it("uses auth.uid() — never trusts a caller-supplied user_id", () => {
    expect(sql).toMatch(/_uid uuid := auth\.uid\(\)/);
    expect(sql).toMatch(/IF _uid IS NULL THEN/);
  });
});
