import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { put, del } from "@vercel/blob";
import AppError from "./appError.ts";

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1GB

const VIDEO_MIME_PREFIXES = ["video/"];

const tmpDir = (() => {
  // Prefer the repo uploads dir (docker runs as root); fall back to the OS
  // tmp dir for local dev where uploads/ may be root-owned.
  try {
    const preferred = path.join(process.cwd(), "uploads", "tmp");
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), "cc-video-uploads");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
})();

const videoUpload = multer({
  // Disk storage: videos are large, never buffer them in memory.
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!VIDEO_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p))) {
      cb(new AppError("Only video files are allowed", 400));
      return;
    }
    cb(null, true);
  },
});

export const uploadVideoMiddleware = (req: any, res: any, next: any) => {
  videoUpload.single("video")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Video is too large (max 1GB)", 400));
      }
      if (err.statusCode) return next(err);
      return next(new AppError(err.message || "Video upload failed", 400));
    }
    if (!req.file) return next(new AppError("No video file provided", 400));
    next();
  });
};

function blobToken(): string {
  const token = process.env.VIDEO_READ_WRITE_TOKEN;
  if (!token) {
    throw new AppError("Video storage is not configured", 500);
  }
  return token;
}

/** Upload a local file to the public bucket, return the public URL. */
export async function putVideoToBucket(
  localPath: string,
  filename: string,
  mimeType?: string
): Promise<{ url: string }> {
  const stream = fs.createReadStream(localPath);
  try {
    const blob = await put(`required-actions/${filename}`, stream as any, {
      access: "public",
      token: blobToken(),
      ...(mimeType ? { contentType: mimeType } : {}),
    });
    return { url: blob.url };
  } finally {
    (stream as any).destroy?.();
    fs.unlink(localPath, () => {});
  }
}

/** Remove a public URL from the bucket (best-effort, never throws). */
export async function deleteVideoFromBucket(url: string): Promise<void> {
  try {
    await del(url, { token: blobToken() });
  } catch (err) {
    console.error("[videoStore] failed to delete blob", url, err);
  }
}
