import { supabase } from "@/integrations/supabase/client";

/**
 * Detach the current user from a workspace they were invited to.
 * Never touches the host's copy or the manuscript.
 */
export async function leaveWorkspace(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_workspace" as never, {
    _request_id: requestId,
  } as never);
  if (error) throw new Error(mapLeaveError(error.message));
}

function mapLeaveError(raw: string): string {
  if (raw.includes("host_cannot_leave")) {
    return "You host this workspace. Delete or cancel it instead of leaving.";
  }
  if (raw.includes("not_a_participant")) {
    return "You're not listed on this workspace anymore.";
  }
  if (raw.includes("request_not_found")) {
    return "That workspace no longer exists.";
  }
  return raw;
}

/**
 * Hard delete a workspace the current user owns. RLS allows this for the
 * creator only. Callers must gate this behind an explicit confirmation.
 */
export async function deleteWorkspacePermanently(requestId: string): Promise<void> {
  const { error } = await supabase.from("collab_requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);
}

/** Normalised title used for duplicate detection. */
export function normalizeWorkspaceTitle(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find an existing workspace with the same title from a candidate list.
 */
export function findDuplicateTitle<T extends { id: string; title: string | null }>(
  title: string,
  existing: ReadonlyArray<T>,
): T | null {
  const needle = normalizeWorkspaceTitle(title);
  if (!needle) return null;
  return existing.find((e) => normalizeWorkspaceTitle(e.title) === needle) ?? null;
}
