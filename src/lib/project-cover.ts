/**
 * Book cover handling for Book Projects.
 *
 * Covers live in the existing `project-images` bucket under
 * `{project_id}/cover/...` so the storage RLS path scoping and the
 * atomic 1GB account cap accounting keep working unchanged.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_IMAGE_BYTES,
  STORAGE_CAP_REACHED_MESSAGE,
  canUploadImage,
} from "./access";

const BUCKET = "project-images";

export const ACCEPTED_COVER_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export class CoverUploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CoverUploadError";
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/** Storage path for a project cover. Root segment must stay the project id. */
export function coverStoragePath(projectId: string, filename: string): string {
  return `${projectId}/cover/${Date.now()}_${sanitizeFilename(filename)}`;
}

export function isAcceptedCoverMime(mime: string): boolean {
  return (ACCEPTED_COVER_MIME_TYPES as readonly string[]).includes(mime);
}

export interface UploadCoverParams {
  projectId: string;
  creatorId: string;
  file: File;
  currentUsedBytes: number;
  /** Existing cover path to remove after a successful replace. */
  previousPath?: string | null;
  previousBytes?: number | null;
}

export interface UploadCoverResult {
  path: string;
  mime: string;
  bytes: number;
  url: string;
}

export async function uploadProjectCover({
  projectId,
  creatorId,
  file,
  currentUsedBytes,
  previousPath,
  previousBytes,
}: UploadCoverParams): Promise<UploadCoverResult> {
  if (!isAcceptedCoverMime(file.type)) {
    throw new CoverUploadError(
      "invalid_format",
      "Cover must be a JPEG or PNG image.",
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new CoverUploadError("file_too_large", "Cover must be 10 MB or smaller.");
  }
  if (!canUploadImage(currentUsedBytes, file.size)) {
    throw new CoverUploadError("storage_cap", STORAGE_CAP_REACHED_MESSAGE);
  }

  const path = coverStoragePath(projectId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) {
    throw new CoverUploadError(
      "upload_failed",
      uploadError.message || "Cover upload failed.",
    );
  }

  const { error: rpcError } = await supabase.rpc("increment_storage_used", {
    _creator_id: creatorId,
    _delta_bytes: file.size,
  });
  if (rpcError) {
    // Destroy the orphan object so the cap accounting stays honest.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new CoverUploadError(
      "storage_cap",
      rpcError.message || STORAGE_CAP_REACHED_MESSAGE,
    );
  }

  if (previousPath && previousPath !== path) {
    await removeCoverObject(previousPath, creatorId, previousBytes ?? 0);
  }

  const url = await getCoverUrl(path);
  return { path, mime: file.type, bytes: file.size, url: url ?? "" };
}

export async function removeCoverObject(
  path: string,
  creatorId: string,
  bytes: number,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new CoverUploadError("delete_failed", error.message);
  await supabase.rpc("increment_storage_used", {
    _creator_id: creatorId,
    _delta_bytes: -Math.max(0, bytes),
  });
}

/** Signed URL for previewing a cover. Returns null when unavailable. */
export async function getCoverUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Raw bytes for embedding a cover into an export bundle. */
export async function downloadCoverBytes(
  path: string,
): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return data.arrayBuffer();
}
