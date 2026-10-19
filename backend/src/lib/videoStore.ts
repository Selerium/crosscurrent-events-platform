import crypto from "crypto";
import path from "path";
import { del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import AppError from "./appError.ts";

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1GB

// Every video blob lives under this prefix; the client never chooses the path.
export const VIDEO_PATH_PREFIX = "required-actions/";

function blobToken(): string {
  const token = process.env.VIDEO_READ_WRITE_TOKEN;
  if (!token) {
    throw new AppError("Video storage is not configured", 500);
  }
  return token;
}

export function buildVideoPathname(filename: string): string {
  const ext = path.extname(filename).toLowerCase() || ".mp4";
  return `${VIDEO_PATH_PREFIX}${Date.now()}-${crypto.randomUUID()}${ext}`;
}

/**
 * Mint a short-lived client token scoped to one pathname, video content
 * types, and the size limit. The browser uses it to `put()` the file
 * straight into the public bucket — the video never passes through the
 * backend.
 */
export async function issueVideoUploadToken(options: {
  filename: string;
  contentType: string;
}): Promise<{ token: string; pathname: string }> {
  const pathname = buildVideoPathname(options.filename);
  const token = await generateClientTokenFromReadWriteToken({
    token: blobToken(),
    pathname,
    allowedContentTypes: ["video/*"],
    maximumSizeInBytes: MAX_VIDEO_BYTES,
    validUntil: Date.now() + 60 * 60 * 1000, // 1 hour
  });
  return { token, pathname };
}

/**
 * Confirm a URL points at a blob in OUR store under the video prefix.
 * Returns the blob metadata (size, content type) for row creation.
 */
export async function verifyBlobInBucket(url: string): Promise<{
  pathname: string;
  size: number;
  contentType: string;
}> {
  let blob;
  try {
    blob = await head(url, { token: blobToken() });
  } catch {
    throw new AppError("URL is not a blob in the configured store", 400);
  }
  if (!blob.pathname.startsWith(VIDEO_PATH_PREFIX)) {
    throw new AppError(
      `Blob must live under ${VIDEO_PATH_PREFIX}`,
      400
    );
  }
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new AppError("Video is too large (max 1GB)", 400);
  }
  return {
    pathname: blob.pathname,
    size: blob.size,
    contentType: blob.contentType,
  };
}

/** Remove a public URL from the bucket (best-effort, never throws). */
export async function deleteVideoFromBucket(url: string): Promise<void> {
  try {
    await del(url, { token: blobToken() });
  } catch (err) {
    console.error("[videoStore] failed to delete blob", url, err);
  }
}
