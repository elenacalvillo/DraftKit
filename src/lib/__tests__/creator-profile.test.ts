import { describe, expect, it, vi } from "vitest";
import {
  buildRpcArgs,
  classifyCreatorProfileError,
  createCreatorProfileViaRpc,
  type SupabaseLike,
} from "../creator-profile";

describe("buildRpcArgs", () => {
  it("maps camelCase input to the underscore-prefixed args the RPC expects", () => {
    // This wire shape MUST match the SQL function declaration in
    // 20260519000000_create_creator_profile_rpc.sql.
    const args = buildRpcArgs({
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
      substackUrl: "https://alice.substack.com",
      newsletterUrl: "https://news.example.com",
      welcomeMessage: "hi",
      joinDirectoryWaitlist: true,
      profileImageUrl: "https://img.example.com/a.png",
      referredByUserId: "ref-1",
    });
    expect(args).toEqual({
      _username: "alice",
      _name: "Alice",
      _email: "alice@example.com",
      _substack_url: "https://alice.substack.com",
      _newsletter_url: "https://news.example.com",
      _welcome_message: "hi",
      _join_directory_waitlist: true,
      _profile_image_url: "https://img.example.com/a.png",
      _referred_by: "ref-1",
    });
  });

  it("fills missing optionals with null / false so the RPC always sees a value", () => {
    const args = buildRpcArgs({
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
    });
    expect(args._substack_url).toBeNull();
    expect(args._newsletter_url).toBeNull();
    expect(args._welcome_message).toBeNull();
    expect(args._profile_image_url).toBeNull();
    expect(args._referred_by).toBeNull();
    expect(args._join_directory_waitlist).toBe(false);
  });
});

describe("classifyCreatorProfileError", () => {
  it("recognises the typed username_taken exception by message", () => {
    const result = classifyCreatorProfileError({
      message: "username_taken",
      code: "23505",
    });
    expect(result.reason).toBe("username_taken");
  });

  it("falls back to username_taken when the driver only surfaces the unique_violation code", () => {
    // Some Supabase clients omit the message and only return the
    // SQLSTATE. We still want to route the user to the username
    // field rather than show a generic toast.
    const result = classifyCreatorProfileError({
      message: "duplicate key value violates unique constraint",
      code: "23505",
    });
    expect(result.reason).toBe("username_taken");
  });

  it("maps not_authenticated by code 42501", () => {
    const result = classifyCreatorProfileError({
      message: "",
      code: "42501",
    });
    expect(result.reason).toBe("not_authenticated");
  });

  it("returns rpc_unknown for unrecognised errors so callers always get a useful reason", () => {
    const result = classifyCreatorProfileError({ message: "boom" });
    expect(result.reason).toBe("rpc_unknown");
    expect(result.message).toBe("boom");
  });
});

describe("createCreatorProfileViaRpc", () => {
  function makeSupabase(
    response: { data: unknown; error: unknown },
  ): SupabaseLike & { calls: Array<{ fn: string; args: unknown }> } {
    const calls: Array<{ fn: string; args: unknown }> = [];
    return {
      calls,
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return response;
      }),
    };
  }

  it("returns the creator row on success (single-object response)", async () => {
    const supabase = makeSupabase({
      data: {
        id: "c1",
        user_id: "u1",
        username: "alice",
        name: "Alice",
      },
      error: null,
    });
    const result = await createCreatorProfileViaRpc(supabase, {
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result.error).toBeNull();
    expect(result.creator?.id).toBe("c1");
    expect(result.creator?.username).toBe("alice");
    expect(supabase.calls[0].fn).toBe("create_creator_profile");
  });

  it("returns the row when Supabase responds with a SETOF array", async () => {
    // The RPC returns SETOF (...), which the JS client surfaces as
    // an array unless the caller chains .single(). The helper has
    // to tolerate both shapes.
    const supabase = makeSupabase({
      data: [
        { id: "c1", user_id: "u1", username: "alice", name: "Alice" },
      ],
      error: null,
    });
    const result = await createCreatorProfileViaRpc(supabase, {
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result.creator?.id).toBe("c1");
    expect(result.error).toBeNull();
  });

  it("classifies a username collision so the UI can scope the error to the field", async () => {
    const result = await createCreatorProfileViaRpc(
      {
        rpc: async () => ({
          data: null,
          error: { message: "username_taken", code: "23505" },
        }),
      },
      { username: "alice", name: "Alice", email: "alice@example.com" },
    );
    expect(result.creator).toBeNull();
    expect(result.error?.reason).toBe("username_taken");
  });

  it("treats an empty data payload as rpc_unknown — never a silent success", async () => {
    const supabase = makeSupabase({ data: null, error: null });
    const result = await createCreatorProfileViaRpc(supabase, {
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result.creator).toBeNull();
    expect(result.error?.reason).toBe("rpc_unknown");
  });

  it("catches thrown errors so callers never need their own try/catch", async () => {
    const result = await createCreatorProfileViaRpc(
      {
        rpc: async () => {
          throw new Error("network down");
        },
      },
      { username: "alice", name: "Alice", email: "alice@example.com" },
    );
    expect(result.creator).toBeNull();
    expect(result.error?.reason).toBe("rpc_unknown");
    expect(result.error?.message).toContain("network down");
  });
});
