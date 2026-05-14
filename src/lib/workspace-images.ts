/**
 * Inline image upload helper for the collaborative workspace editor.
 *
 * This module is the SINGLE entry point the WorkspaceEditor uses for
 * every image insertion path — toolbar button, drag-and-drop, and
 * clipboard paste. Routing all three methods through one function is
 * what guarantees compression and Supabase Storage upload always
 * happen and that base64 data URIs never reach the database.
 *
 * Key invariants this module enforces:
 *
 *   1. Client-side compression to <= 1 MB using
 *      `browser-image-compression` BEFORE any bytes are sent to the
 *      network. Saves bandwidth and stays well under the 10 MB bucket
 *      limit. This is invisible for typical screenshots.
 *
 *   2. Mime type whitelist (JPEG / PNG / GIF / WebP). Anything else
 *      throws `WorkspaceImageError("invalid_format", …)` so callers
 *      can show a toast and ignore the file.
 *
 *   3. Returns a Supabase Storage PUBLIC URL — never a signed URL.
 *      The collab_requests.shared_content column persists the URL and
 *      must be renderable to public-link viewers (creator + guest +
 *      anonymous public sheet) without any auth roundtrip.
 *
 *   4. NEVER returns a base64 data URI. If you find a code path that
 *      emits "data:image/..." into editor content, fix it here —
 *      not by sanitising downstream.
 *
 *   5. Scoping: files live at `{request_id}/{filename}`. The bucket
 *      RLS policy (`workspace-images` bucket) uses
 *      `(storage.foldername(name))[1]` to derive request_id and
 *      checks `public.has_workspace_access(auth.uid(), request_id)`.
 *      Available to free + Pro alike — no tier gate.
 */
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  isAcceptedImageMime,
} from "./access";

export const WORKSPACE_IMAGES_BUCKET = "workspace-images";

/** Hard ceiling shipped to Supabase. We compress to <= this size. */
export const WORKSPACE_IMAGE_MAX_COMPRESSED_BYTES = 1 * 1024 * 1024; // 1 MB

/** Defence-in-depth ceiling for the raw input file. */
export const WORKSPACE_IMAGE_MAX_RAW_BYTES = 25 * 1024 * 1024; // 25 MB

export interface WorkspaceImageUploadResult {
  /** Path stored in storage.objects.name (request_id/filename). */
  path: string;
  /**
   * Supabase Storage public URL — what gets embedded into the
   * editor as `<img src="...">` and persisted in `shared_content`.
   *
   * Always begins with `https://`. NEVER a base64 data URI.
   */
  publicUrl: string;
  /** Final byte size after client-side compression. */
  size: number;
}

export class WorkspaceImageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "WorkspaceImageError";
  }
}

/**
 * Strip filesystem-unsafe characters and clamp length so we never
 * generate object names that need URL-encoding (which would force
 * us to also URL-encode the public URL on every render).
 */
export function sanitizeWorkspaceImageFilename(name: string): string {
  // Strip extension separately so we can normalise the basename.
  const lastDot = name.lastIndexOf(".");
  const base = lastDot >= 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot >= 0 ? name.slice(lastDot + 1) : "";
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "image";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

/**
 * Build the canonical storage path for a workspace image.
 *
 * Public so the RLS contract is explicit:
 *   `{request_id}/{filename}` — the first folder must be the
 *   request_id so RLS can derive it via storage.foldername(name)[1].
 *
 * The filename is prefixed with a timestamp so concurrent edits
 * from two devices producing the same `screenshot.png` don't
 * collide.
 */
export function buildWorkspaceImagePath(
  requestId: string,
  filename: string,
): string {
  if (!requestId) {
    throw new WorkspaceImageError(
      "missing_request_id",
      "Cannot upload a workspace image without a request id.",
    );
  }
  const safe = sanitizeWorkspaceImageFilename(filename);
  return `${requestId}/${Date.now()}_${safe}`;
}

/**
 * Validate that a File is one of the accepted image types.
 *
 * Pulled out so paste/drop handlers can bail BEFORE bothering to
 * compress a non-image binary.
 */
export function isWorkspaceImageFile(file: File | Blob | null | undefined): boolean {
  if (!file) return false;
  const type = (file as File).type;
  return typeof type === "string" && isAcceptedImageMime(type);
}

export interface CompressWorkspaceImageOptions {
  /**
   * Hard upper bound on the output size, in MB. Defaults to 1 MB
   * (the spec). Exposed so tests can verify the parameter without
   * shipping a behaviour difference.
   */
  maxSizeMB?: number;
  /**
   * Maximum width or height for the longest edge, in px. The
   * `browser-image-compression` library scales down while preserving
   * aspect ratio. 1920 covers retina-quality screenshots without
   * exploding storage usage for purely visual assets.
   */
  maxWidthOrHeight?: number;
}

/**
 * Compress an image File entirely client-side using
 * `browser-image-compression`. Returns the compressed File (same
 * mime type) or throws WorkspaceImageError on failure.
 *
 * Compression is invisible — sub-3 MB inputs typically complete in
 * a single animation frame using a Web Worker.
 */
export async function compressWorkspaceImage(
  file: File,
  options: CompressWorkspaceImageOptions = {},
): Promise<File> {
  const maxSizeMB =
    options.maxSizeMB ??
    WORKSPACE_IMAGE_MAX_COMPRESSED_BYTES / (1024 * 1024);
  const maxWidthOrHeight = options.maxWidthOrHeight ?? 1920;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: true,
      // Preserve the original mime so PNGs with transparency stay
      // PNGs; otherwise the library would force JPEG.
      fileType: file.type,
      // Avoid scrubbing EXIF orientation flags that browsers apply
      // automatically; the library handles rotation correctly when
      // this is true (the default).
      initialQuality: 0.85,
    });

    // browser-image-compression returns a Blob in some paths; coerce
    // back to a File so storage.upload() infers the filename + type
    // identically to the user-provided File.
    if (compressed instanceof File) return compressed;
    return new File([compressed], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  } catch (err) {
    throw new WorkspaceImageError(
      "compression_failed",
      err instanceof Error ? err.message : "Image compression failed.",
    );
  }
}

export interface UploadWorkspaceImageParams {
  requestId: string;
  file: File;
  /**
   * Optional override — primarily useful in tests. Production code
   * should call `uploadWorkspaceImage` and let the helper compress.
   */
  compress?: typeof compressWorkspaceImage;
}

/**
 * End-to-end: validate → compress → upload → return public URL.
 *
 * This is the function the editor calls from all three input
 * methods (toolbar / drop / paste). No code path should bypass it.
 */
export async function uploadWorkspaceImage({
  requestId,
  file,
  compress = compressWorkspaceImage,
}: UploadWorkspaceImageParams): Promise<WorkspaceImageUploadResult> {
  if (!isWorkspaceImageFile(file)) {
    throw new WorkspaceImageError(
      "invalid_format",
      `Unsupported file format. Allowed: ${ACCEPTED_IMAGE_MIME_TYPES.join(", ")}`,
    );
  }
  if (file.size > WORKSPACE_IMAGE_MAX_RAW_BYTES) {
    throw new WorkspaceImageError(
      "file_too_large",
      "Image is too large to upload. Please use one under 25 MB.",
    );
  }

  const compressed = await compress(file);
  const path = buildWorkspaceImagePath(requestId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(WORKSPACE_IMAGES_BUCKET)
    .upload(path, compressed, {
      contentType: compressed.type || file.type,
      // Each filename is timestamped so we shouldn't normally clash,
      // but if the user spams the same paste 3× in a second we'd
      // rather upsert than confuse them with a "duplicate" error.
      upsert: true,
    });

  if (uploadError) {
    throw new WorkspaceImageError(
      "upload_failed",
      uploadError.message || "Image upload failed.",
    );
  }

  const { data } = supabase.storage
    .from(WORKSPACE_IMAGES_BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl || !/^https?:\/\//.test(data.publicUrl)) {
    // The supabase-js helper always returns a string, but if the
    // bucket flips to private we'd lose the URL — fail loudly rather
    // than silently fall back to base64 (the core ticket risk).
    throw new WorkspaceImageError(
      "public_url_failed",
      "Could not resolve a public URL for the uploaded image.",
    );
  }
  if (data.publicUrl.startsWith("data:")) {
    // Belt-and-braces: literally impossible from getPublicUrl, but if
    // we ever change the helper, this assertion turns a silent
    // database-bloat regression into a screaming runtime error.
    throw new WorkspaceImageError(
      "public_url_failed",
      "Refusing to return a base64 data URI as the image src.",
    );
  }

  return { path, publicUrl: data.publicUrl, size: compressed.size };
}

/**
 * Remove any `<img>` tags whose `src` is a base64 data URI from an
 * HTML string.
 *
 * This is a defence-in-depth guard around the rendered/sanitised
 * draft. The upload path (`uploadWorkspaceImage` above) already
 * makes it impossible for new images inserted through the editor
 * to carry a base64 src, but legacy drafts written before this
 * ticket shipped may still hold inline data URIs. Stripping them
 * at sanitise time means we render NOTHING (rather than a multi-MB
 * blob from inside the HTML) and gives us a clear signal during
 * verification: if you ever see a missing image in an old draft,
 * that is the base64 -> URL migration story, not a regression.
 *
 * Implemented as a string-level regex (rather than a DOM round-trip)
 * for the same reason `stripDraftKitInternalAttrs` is — it keeps the
 * caller usable in non-DOM environments and avoids subtly mutating
 * whitespace / attribute quoting in the surrounding HTML.
 */
export function stripBase64ImageTags(html: string): string {
  if (!html) return "";
  // Match <img> tags whose src attribute starts with data: in either
  // quote style. Non-greedy on the attr value so adjacent tags do
  // not get gobbled together.
  return html
    .replace(/<img\b[^>]*\bsrc\s*=\s*"data:[^"]*"[^>]*\/?\s*>/gi, "")
    .replace(/<img\b[^>]*\bsrc\s*=\s*'data:[^']*'[^>]*\/?\s*>/gi, "");
}
