import { describe, it, expect } from "vitest";
import { parseSaveError } from "@/lib/save-workspace-errors";

describe("parseSaveError — guest-side save regression guard", () => {
  it("maps not_authenticated", () => {
    const r = parseSaveError(new Error("not_authenticated"));
    expect(r.reason).toBe("not_authenticated");
    expect(r.friendly).toMatch(/sign(ed)? in/i);
  });

  it("maps not_a_participant (the silent-RLS reject we just fixed)", () => {
    const r = parseSaveError(new Error("not_a_participant"));
    expect(r.reason).toBe("not_a_participant");
    expect(r.friendly).toMatch(/linked|invite/i);
  });

  it("extracts the status detail from status_not_approved:<status>", () => {
    const r = parseSaveError(new Error("status_not_approved:cancelled"));
    expect(r.reason).toBe("status_not_approved");
    expect(r.detail).toBe("cancelled");
    expect(r.friendly).toMatch(/cancelled/);
  });

  it("falls back to a sane status_not_approved message without a detail", () => {
    const r = parseSaveError(new Error("status_not_approved"));
    expect(r.reason).toBe("status_not_approved");
    expect(r.detail).toBeUndefined();
  });

  it("maps request_not_found", () => {
    const r = parseSaveError(new Error("request_not_found"));
    expect(r.reason).toBe("request_not_found");
  });

  it("buckets fetch/network failures separately so we can alert on them", () => {
    expect(parseSaveError(new Error("Failed to fetch")).reason).toBe("network_error");
    expect(parseSaveError(new Error("NetworkError when attempting to fetch resource")).reason).toBe(
      "network_error",
    );
    expect(parseSaveError(new Error("offline")).reason).toBe("network_error");
  });

  it("falls back to 'unknown' for anything else, preserving the raw message", () => {
    const r = parseSaveError(new Error("boom 42"));
    expect(r.reason).toBe("unknown");
    expect(r.friendly).toContain("boom 42");
  });

  it("does not silently swallow Postgres 42702 ambiguous-column failures (regression: version-history rollout)", () => {
    const r = parseSaveError(new Error('column reference "id" is ambiguous'));
    expect(r.reason).toBe("unknown");
    expect(r.friendly).toContain("ambiguous");
  });

  it("handles non-Error inputs without throwing", () => {
    expect(parseSaveError("not_a_participant").reason).toBe("not_a_participant");
    expect(parseSaveError(null).reason).toBe("unknown");
    expect(parseSaveError({ message: "request_not_found" }).reason).toBe("request_not_found");
  });
});
