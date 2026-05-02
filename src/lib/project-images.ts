/**
 * Image upload helper for Book Project workspaces.
 *
 * - Validates file size and mime type against the app-level rules
 *   (10MB max, jpeg/png/webp/gif).
 * - Uploads to the `project-images` Supabase Storage bucket scoped
 *   under `{project_id}/{filename}`.
 * - Updates `creators.storage_used_bytes` atomically via the
 *   `increment_storage_used` RPC so per-account 1GB cap is enforced.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  STORAGE_CAP_REACHED_MESSAGE,
  canUploadImage,
  isAcceptedImageMime,
} from "./access";

const BUCKET = "project-images";

export interface UploadResult {
  /** Public path stored in `storage.objects.name` */
  path: string;
  /** Signed URL good for ~1 hour */
  url: string;
  /** Size in bytes */
  size: number;
}

interface UploadParams {
  projectId: string;
  creatorId: string;
  file: File;
  /** current storage_used_bytes, used for client-side cap pre-check */
  currentUsedBytes: number;
}

export class ImageUploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ImageUploadError";
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export async function uploadProjectImage({
  projectId,
  creatorId,
  file,
  currentUsedBytes,
}: UploadParams): Promise<UploadResult> {
  if (!isAcceptedImageMime(file.type)) {
    throw new ImageUploadError(
      "invalid_format",
      `Unsupported file format. Allowed: ${ACCEPTED_IMAGE_MIME_TYPES.join(", ")}`,
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError(
      "file_too_large",
      "Images must be 10 MB or smaller.",
    );
  }
  if (!canUploadImage(currentUsedBytes, file.size)) {
    throw new ImageUploadError("storage_cap", STORAGE_CAP_REACHED_MESSAGE);
  }

  const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const path = `${projectId}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      // overwrite if a duplicate path is attempted instead of
      // accumulating extra storage.
      upsert: true,
    });

  if (uploadError) {
    throw new ImageUploadError(
      "upload_failed",
      uploadError.message || "Image upload failed.",
    );
  }

  // Increment storage usage atomically. If this throws (cap exceeded
  // server-side), we delete the uploaded object to keep accounting
  // consistent.
  const { error: rpcError } = await supabase.rpc("increment_storage_used", {
    _creator_id: creatorId,
    _delta_bytes: file.size,
  });
  if (rpcError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new ImageUploadError(
      "storage_cap",
      rpcError.message || STORAGE_CAP_REACHED_MESSAGE,
    );
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (signedError || !signed?.signedUrl) {
    throw new ImageUploadError(
      "signed_url_failed",
      signedError?.message || "Could not create signed URL for image.",
    );
  }

  return { path, url: signed.signedUrl, size: file.size };
}

export async function deleteProjectImage(
  path: string,
  creatorId: string,
  size: number,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new ImageUploadError("delete_failed", error.message);
  // Decrement (negative delta).
  await supabase.rpc("increment_storage_used", {
    _creator_id: creatorId,
    _delta_bytes: -Math.max(0, size),
  });
}
