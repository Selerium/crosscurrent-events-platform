import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import AppError from "./appError.ts";

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1GB

// Public path prefix for stored videos (served by nginx in production and by
// the Express static handler in development).
export const VIDEOS_URL_PREFIX = "/uploads/videos/";

export const videosDir = path.join(process.cwd(), "uploads", "videos");
fs.mkdirSync(videosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      cb(new AppError("Only video files are allowed", 400));
      return;
    }
    cb(null, true);
  },
});

/** Accepts a single multipart field named "video", stored on local disk. */
export const uploadVideoMiddleware = (req: any, res: any, next: any) => {
  upload.single("video")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Video is too large (max 1GB)", 400));
      }
      if (err.statusCode) return next(err);
      return next(new AppError(err.message || "Video upload failed", 400));
    }
    next();
  });
};

/** Absolute, publicly reachable URL for a stored video file. */
export function buildVideoUrl(req: any, filename: string): string {
  return `${req.protocol}://${req.get("host")}${VIDEOS_URL_PREFIX}${filename}`;
}

/**
 * Remove a previously stored video file. URLs that don't point at the local
 * videos folder (e.g. legacy Vercel Blob URLs) are left untouched.
 */
export function deleteVideoFile(url: string): void {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return;
  }
  if (!pathname.startsWith(VIDEOS_URL_PREFIX)) return;

  const filename = path.basename(pathname);
  if (!filename) return;

  fs.unlink(path.join(videosDir, filename), (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("[videoStore] failed to delete video file", filename, err);
    }
  });
}
