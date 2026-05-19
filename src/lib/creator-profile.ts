/**
 * Atomic creator-profile creation helper.
 *
 * Wraps the `public.create_creator_profile` Supabase RPC, which
 * does the two-table insert (creators + creator_contacts) in one
 * Postgres transaction. Previously the frontend did these as two
 * separate inserts with a manual delete-rollback, which left
 * "ghost users" behind when the rollback itself silently failed.
 *
 * This module is the single source of truth for:
 *   - parsing the typed errors the RPC raises (username_taken,
 *     username_required, ...), so the UI can show the right
 *     inline message;
 *   - mapping every failure path to an analytics event so we can
 *     observe regressions without users having to report them.
 */

export interface CreateCreatorProfileInput {
  username: string;
  name: string;
  email: string;
  substackUrl?: string | null;
  newsletterUrl?: string | null;
  welcomeMessage?: string | null;
  joinDirectoryWaitlist?: boolean;
  profileImageUrl?: string | null;
  referredByUserId?: string | null;
}

export interface CreatorProfileRow {
  id: string;
  user_id: string;
  username: string;
  name: string;
}

/** Discriminated union of error reasons the RPC may surface. */
export type CreateCreatorProfileErrorReason =
  | "username_taken"
  | "username_required"
  | "email_required"
  | "not_authenticated"
  | "rpc_unknown";

export interface CreateCreatorProfileError {
  reason: CreateCreatorProfileErrorReason;
  message: string;
}

/**
 * The return shape is intentionally non-discriminated: callers
 * check `creator` (truthy → success, null → see `error`). With
 * the project's `strict: false` tsconfig, a discriminated union
 * on `ok: true/false` doesn't narrow correctly at the call site.
 */
export interface CreateCreatorProfileResult {
  creator: CreatorProfileRow | null;
  error: CreateCreatorProfileError | null;
}

/**
 * Inspect a Supabase error and decide which actionable
 * `reason` to surface to the UI.
 *
 * Errors raised by the RPC carry their semantics in `message`
 * (e.g. `username_taken`) and ERRCODE-mapped `code` (e.g. 23505).
 * We key off both so a future driver that strips one field still
 * routes correctly.
 */
export function classifyCreatorProfileError(err: {
  message?: string | null;
  code?: string | null;
  details?: string | null;
}): CreateCreatorProfileError {
  const msg = (err?.message ?? "").toString();
  const code = (err?.code ?? "").toString();
  const details = (err?.details ?? "").toString();
  const haystack = `${msg} ${details}`.toLowerCase();

  if (haystack.includes("username_taken")) {
    return { reason: "username_taken", message: msg };
  }
  if (haystack.includes("username_required")) {
    return { reason: "username_required", message: msg };
  }
  if (haystack.includes("email_required")) {
    return { reason: "email_required", message: msg };
  }
  if (haystack.includes("not_authenticated") || code === "42501") {
    return { reason: "not_authenticated", message: msg };
  }
  // A bare Postgres unique-violation (no semantic prefix) almost
  // certainly means username collision — the only UNIQUE on the
  // creator-creation path the user controls.
  if (code === "23505") {
    return { reason: "username_taken", message: msg };
  }
  return { reason: "rpc_unknown", message: msg || "Unknown error" };
}

/**
 * Build the args object the RPC expects from the camelCase input
 * the UI uses. Pulled out so tests can pin the wire shape down
 * independent of the call site.
 */
export function buildRpcArgs(input: CreateCreatorProfileInput) {
  return {
    _username: input.username,
    _name: input.name,
    _email: input.email,
    _substack_url: input.substackUrl ?? null,
    _newsletter_url: input.newsletterUrl ?? null,
    _welcome_message: input.welcomeMessage ?? null,
    _join_directory_waitlist: input.joinDirectoryWaitlist ?? false,
    _profile_image_url: input.profileImageUrl ?? null,
    _referred_by: input.referredByUserId ?? null,
  };
}

/**
 * Minimal interface for the rpc surface we use — accepts any
 * thenable return value so the real `SupabaseClient.rpc` (which
 * returns a PostgrestFilterBuilder, not a Promise) is assignable.
 */
export interface SupabaseLike {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Execute the RPC and return either a fully-formed creator row
 * or a classified error. Either path is observable in analytics
 * by the caller — this function never throws.
 */
export async function createCreatorProfileViaRpc(
  supabase: SupabaseLike,
  input: CreateCreatorProfileInput,
): Promise<CreateCreatorProfileResult> {
  try {
    const { data, error } = await supabase.rpc(
      "create_creator_profile",
      buildRpcArgs(input),
    );
    if (error) {
      return {
        creator: null,
        error: classifyCreatorProfileError(
          error as { message?: string; code?: string; details?: string },
        ),
      };
    }
    // The RPC returns SETOF (id, user_id, username, name). Supabase
    // wraps this as an array unless `.single()` was used — be
    // tolerant of either shape so the helper works regardless of
    // how callers chain.
    const row = Array.isArray(data)
      ? (data[0] as CreatorProfileRow | undefined)
      : (data as CreatorProfileRow | null);
    if (!row || !row.id) {
      return {
        creator: null,
        error: { reason: "rpc_unknown", message: "Empty RPC response" },
      };
    }
    return { creator: row, error: null };
  } catch (e) {
    return {
      creator: null,
      error: {
        reason: "rpc_unknown",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    };
  }
}
