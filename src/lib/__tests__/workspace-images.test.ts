/**
 * @vitest-environment jsdom
 *
 * Tests for the workspace image upload pipeline.
 *
 * The core ticket invariant is "base64 must never reach the database".
 * These tests exercise the seams that enforce that:
 *
 *   - sanitizeWorkspaceImageFilename: produces URL-safe paths so
 *     getPublicUrl() returns a string we can drop straight into
 *     `<img src>` without further encoding.
 *
 *   - buildWorkspaceImagePath: confirms the request_id appears as
 *     the FIRST folder so the storage RLS policy (which uses
 *     storage.foldername(name)[1]) authorises the writer.
 *
 *   - isWorkspaceImageFile / mime whitelist: makes sure the editor's
 *     paste/drop handlers will reject non-image binaries.
 *
 *   - stripBase64ImageTags: belt-and-braces sanitiser hook used in
 *     SharedWorkspace to render NOTHING for legacy data: URIs rather
 *     than letting megabytes of base64 land in the DOM.
 *
 *   - uploadWorkspaceImage: end-to-end test against a mocked
 *     supabase.storage client. We assert that (1) compression runs
 *     before upload, (2) the returned URL is the public URL (https),
 *     (3) errors surface as WorkspaceImageError, (4) we NEVER fall
 *     back to a data: URI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// browser-image-compression spins up a Web Worker which jsdom doesn't
// support. We mock the module at the top of the file so the import in
// workspace-images doesn't try to load it for real, and so individual
// tests can swap in their own behaviour.
vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => file),
}));

// The supabase client pulls in vite env vars; mock the module so our
// tests can stub the storage methods without touching the network.
const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  },
}));

import imageCompression from "browser-image-compression";
import {
  WORKSPACE_IMAGES_BUCKET,
  WORKSPACE_IMAGE_MAX_COMPRESSED_BYTES,
  WORKSPACE_IMAGE_MAX_RAW_BYTES,
  WorkspaceImageError,
  buildWorkspaceImagePath,
  compressWorkspaceImage,
  isWorkspaceImageFile,
  sanitizeWorkspaceImageFilename,
  stripBase64ImageTags,
  uploadWorkspaceImage,
} from "../workspace-images";

function makeFile(name: string, type: string, size = 1024): File {
  // Pad the underlying buffer to match the requested size so the
  // File.size getter reports the value tests assert against.
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("workspace-images constants", () => {
  it("targets the 1 MB compressed ceiling required by the ticket", () => {
    expect(WORKSPACE_IMAGE_MAX_COMPRESSED_BYTES).toBe(1024 * 1024);
  });

  it("uses the dedicated workspace-images bucket (not project-images)", () => {
    // This is a contract test against the migration — flipping the
    // bucket name without updating the SQL migration would break
    // every upload silently. Failing here makes the regression loud.
    expect(WORKSPACE_IMAGES_BUCKET).toBe("workspace-images");
  });
});

describe("sanitizeWorkspaceImageFilename", () => {
  it("strips characters that would force URL-encoding", () => {
    expect(sanitizeWorkspaceImageFilename("hello world!.png")).toBe(
      "hello_world_.png",
    );
    expect(sanitizeWorkspaceImageFilename("café/photo.JPEG")).toBe(
      "caf__photo.jpeg",
    );
  });

  it("keeps simple ASCII names untouched (other than lower-casing the ext)", () => {
    expect(sanitizeWorkspaceImageFilename("Screenshot.PNG")).toBe(
      "Screenshot.png",
    );
  });

  it("falls back to 'image' when the base would be empty", () => {
    expect(sanitizeWorkspaceImageFilename(".jpeg")).toBe("image.jpeg");
  });

  it("clamps very long basenames", () => {
    const long = "a".repeat(500) + ".png";
    const out = sanitizeWorkspaceImageFilename(long);
    expect(out.length).toBeLessThanOrEqual(80 + 1 + 8);
    expect(out.endsWith(".png")).toBe(true);
  });
});

describe("buildWorkspaceImagePath", () => {
  it("puts the request_id as the FIRST folder so RLS can derive it", () => {
    const reqId = "11111111-2222-3333-4444-555555555555";
    const path = buildWorkspaceImagePath(reqId, "shot.png");
    // storage.foldername(name)[1] in Postgres splits on '/' and uses
    // 1-indexed access — the request_id must be everything before
    // the FIRST slash.
    expect(path.startsWith(`${reqId}/`)).toBe(true);
  });

  it("prefixes the filename with a timestamp to avoid collisions", () => {
    const path = buildWorkspaceImagePath("req", "image.png");
    expect(path).toMatch(/^req\/\d{10,}_image\.png$/);
  });

  it("refuses to build a path without a request id", () => {
    expect(() => buildWorkspaceImagePath("", "image.png")).toThrowError(
      WorkspaceImageError,
    );
  });
});

describe("isWorkspaceImageFile", () => {
  it("accepts only JPEG, PNG, GIF, WebP", () => {
    expect(isWorkspaceImageFile(makeFile("a.jpg", "image/jpeg"))).toBe(true);
    expect(isWorkspaceImageFile(makeFile("a.png", "image/png"))).toBe(true);
    expect(isWorkspaceImageFile(makeFile("a.gif", "image/gif"))).toBe(true);
    expect(isWorkspaceImageFile(makeFile("a.webp", "image/webp"))).toBe(true);
    expect(isWorkspaceImageFile(makeFile("a.heic", "image/heic"))).toBe(false);
    expect(isWorkspaceImageFile(makeFile("a.pdf", "application/pdf"))).toBe(
      false,
    );
  });

  it("returns false for null / missing input", () => {
    expect(isWorkspaceImageFile(null)).toBe(false);
    expect(isWorkspaceImageFile(undefined)).toBe(false);
  });
});

describe("compressWorkspaceImage", () => {
  beforeEach(() => {
    vi.mocked(imageCompression).mockReset();
  });

  it("forwards the 1 MB target and preserves the original mime", async () => {
    const file = makeFile("a.png", "image/png");
    vi.mocked(imageCompression).mockResolvedValueOnce(file);

    await compressWorkspaceImage(file);
    expect(imageCompression).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(imageCompression).mock.calls[0];
    expect(opts.maxSizeMB).toBe(1);
    expect(opts.fileType).toBe("image/png");
    // useWebWorker keeps compression off the main thread for the
    // sub-3 MB invisible-latency criterion in the ticket.
    expect(opts.useWebWorker).toBe(true);
  });

  it("wraps a Blob result back into a File so storage.upload infers the name", async () => {
    const original = makeFile("photo.jpg", "image/jpeg");
    const blob = new Blob(["compressed"], { type: "image/jpeg" }) as Blob &
      Partial<File>;
    vi.mocked(imageCompression).mockResolvedValueOnce(blob as never);

    const result = await compressWorkspaceImage(original);
    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
  });

  it("wraps compression failures in WorkspaceImageError", async () => {
    vi.mocked(imageCompression).mockRejectedValueOnce(new Error("worker died"));
    await expect(
      compressWorkspaceImage(makeFile("a.png", "image/png")),
    ).rejects.toThrow(WorkspaceImageError);
  });
});

describe("uploadWorkspaceImage", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();
  });

  afterEach(() => {
    vi.mocked(imageCompression).mockReset();
  });

  it("compresses, uploads, and returns the resolved https:// public URL", async () => {
    const file = makeFile("photo.png", "image/png", 2 * 1024 * 1024);
    const compressed = makeFile("photo.png", "image/png", 256 * 1024);
    uploadMock.mockResolvedValueOnce({ data: { path: "req/photo.png" }, error: null });
    getPublicUrlMock.mockReturnValueOnce({
      data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/workspace-images/req/photo.png" },
    });

    const compress = vi.fn().mockResolvedValueOnce(compressed);

    const result = await uploadWorkspaceImage({
      requestId: "req",
      file,
      compress,
    });

    expect(compress).toHaveBeenCalledWith(file);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(getPublicUrlMock).toHaveBeenCalledTimes(1);
    // The src that gets embedded in the editor MUST be https:// — the
    // single most important assertion in this entire file.
    expect(result.publicUrl.startsWith("https://")).toBe(true);
    expect(result.publicUrl.includes("data:")).toBe(false);
    expect(result.size).toBe(compressed.size);
  });

  it("rejects non-image mime types BEFORE compressing or uploading", async () => {
    const compress = vi.fn();
    await expect(
      uploadWorkspaceImage({
        requestId: "req",
        file: makeFile("brief.pdf", "application/pdf"),
        compress,
      }),
    ).rejects.toMatchObject({
      name: "WorkspaceImageError",
      code: "invalid_format",
    });
    expect(compress).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects raw files larger than the defensive 25 MB ceiling", async () => {
    const file = makeFile(
      "huge.png",
      "image/png",
      WORKSPACE_IMAGE_MAX_RAW_BYTES + 1,
    );
    await expect(
      uploadWorkspaceImage({ requestId: "req", file, compress: vi.fn() }),
    ).rejects.toMatchObject({ code: "file_too_large" });
  });

  it("surfaces a Supabase upload error as WorkspaceImageError without inserting a placeholder", async () => {
    uploadMock.mockResolvedValueOnce({
      data: null,
      error: { message: "RLS denied" },
    });
    await expect(
      uploadWorkspaceImage({
        requestId: "req",
        file: makeFile("a.png", "image/png"),
        compress: async (f) => f,
      }),
    ).rejects.toMatchObject({ code: "upload_failed" });
  });

  it("refuses to return a base64 URL if Supabase ever hands us one (defensive)", async () => {
    uploadMock.mockResolvedValueOnce({ data: { path: "req/a.png" }, error: null });
    getPublicUrlMock.mockReturnValueOnce({
      // Hypothetical broken supabase-js bug — must FAIL LOUDLY, not
      // silently land base64 in the database.
      data: { publicUrl: "data:image/png;base64,AAAA" },
    });
    await expect(
      uploadWorkspaceImage({
        requestId: "req",
        file: makeFile("a.png", "image/png"),
        compress: async (f) => f,
      }),
    ).rejects.toMatchObject({ code: "public_url_failed" });
  });

  it("fails loudly if getPublicUrl returns no URL at all (e.g. bucket flipped private)", async () => {
    uploadMock.mockResolvedValueOnce({ data: { path: "req/a.png" }, error: null });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: "" } });
    await expect(
      uploadWorkspaceImage({
        requestId: "req",
        file: makeFile("a.png", "image/png"),
        compress: async (f) => f,
      }),
    ).rejects.toMatchObject({ code: "public_url_failed" });
  });
});

describe("stripBase64ImageTags", () => {
  it("removes <img> tags with double-quoted data: URIs", () => {
    const input = `<p>Hi</p><img src="data:image/png;base64,AAAA" alt="boom"/><p>Bye</p>`;
    const out = stripBase64ImageTags(input);
    expect(out).not.toContain("data:");
    expect(out).not.toMatch(/<img/);
    expect(out).toContain("<p>Hi</p>");
    expect(out).toContain("<p>Bye</p>");
  });

  it("removes <img> tags with single-quoted data: URIs", () => {
    const input = `<img src='data:image/jpeg;base64,XYZ' />`;
    expect(stripBase64ImageTags(input)).toBe("");
  });

  it("preserves <img> tags with https:// sources", () => {
    const input = `<img src="https://example.supabase.co/storage/v1/foo.png" alt="ok"/>`;
    expect(stripBase64ImageTags(input)).toBe(input);
  });

  it("preserves mixed content with both kinds of img tags", () => {
    const good = `<img src="https://cdn.example.com/a.png" alt="a"/>`;
    const bad = `<img src="data:image/png;base64,ZZZ" alt="b"/>`;
    const out = stripBase64ImageTags(`<p>x</p>${good}${bad}<p>y</p>`);
    expect(out).toContain(good);
    expect(out).not.toContain("data:");
  });

  it("returns empty string for falsy input", () => {
    expect(stripBase64ImageTags("")).toBe("");
    expect(stripBase64ImageTags(undefined as unknown as string)).toBe("");
  });
});
