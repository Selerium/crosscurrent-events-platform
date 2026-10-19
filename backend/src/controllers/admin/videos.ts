import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import {
  MAX_VIDEO_BYTES,
  issueVideoUploadToken,
  verifyBlobInBucket,
  deleteVideoFromBucket,
} from "../../lib/videoStore.ts";

// Mounted at /admin/videos.
const adminVideosHandler = express.Router();

// GET /admin/videos — global library for the admin dropdown (titles).
adminVideosHandler.get("", async (_req, res) => {
  const videos = await prisma.videoAsset.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ data: videos, error: false, message: "" });
});

// POST /admin/videos/upload-token — mint a scoped client upload token so the
// browser can send the video straight to the blob bucket (never through the
// backend). Constrained to video/*, 1GB, one pathname, 1 hour.
adminVideosHandler.post("/upload-token", async (req, res) => {
  const filename = String(req.body?.filename ?? "").trim();
  const contentType = String(req.body?.contentType ?? "").trim().toLowerCase();
  const sizeBytes = Number(req.body?.sizeBytes);

  if (!filename) {
    throw new AppError("A filename is required", 400);
  }
  if (!contentType.startsWith("video/")) {
    throw new AppError("Only video files are allowed", 400);
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new AppError("A valid file size is required", 400);
  }
  if (sizeBytes > MAX_VIDEO_BYTES) {
    throw new AppError("Video is too large (max 1GB)", 400);
  }

  const { token, pathname } = await issueVideoUploadToken({
    filename,
    contentType,
  });

  res.status(200).json({ data: { token, pathname }, error: false, message: "" });
});

// POST /admin/videos — register a blob the admin already uploaded directly
// to the bucket (via the upload-token flow) as a library asset.
adminVideosHandler.post("", async (req: any, res) => {
  const title = String(req.body?.title ?? "").trim();
  const url = String(req.body?.url ?? "").trim();
  if (!title) {
    throw new AppError("A title is required", 400);
  }
  if (!url) {
    throw new AppError("A blob url is required", 400);
  }

  // Idempotent: a retried registration returns the existing row.
  const existing = await prisma.videoAsset.findUnique({ where: { url } });
  if (existing) {
    res.status(200).json({ data: existing, error: false, message: "Video uploaded" });
    return;
  }

  // Proves the URL is a blob in OUR store under the video prefix and
  // enforces the size cap; also gives us the authoritative metadata.
  const blob = await verifyBlobInBucket(url);
  if (!blob.contentType.startsWith("video/")) {
    throw new AppError("Blob is not a video", 400);
  }

  const asset = await prisma.videoAsset.create({
    data: {
      title,
      url,
      mimeType: blob.contentType,
      sizeBytes: blob.size,
      uploadedById: req.user!.id,
    },
  });

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "video.upload",
    targetType: "video-asset",
    targetId: asset.id,
    details: { title, sizeBytes: blob.size, pathname: blob.pathname },
    success: true,
  });

  res.status(201).json({ data: asset, error: false, message: "Video uploaded" });
});

// DELETE /admin/videos/:id — removes the library row AND the blob.
adminVideosHandler.delete("/:id", async (req, res) => {
  const asset = await prisma.videoAsset.findUnique({
    where: { id: req.params.id },
  });
  if (!asset) throw new AppError("Video not found", 404);

  const inUse = await prisma.requiredAction.count({
    where: { videoUrl: asset.url, deletedAt: null },
  });
  if (inUse > 0) {
    throw new AppError(
      `Video is used by ${inUse} required action${inUse === 1 ? "" : "s"} and cannot be deleted`,
      409
    );
  }

  await prisma.videoAsset.delete({ where: { id: asset.id } });
  await deleteVideoFromBucket(asset.url);

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "video.delete",
    targetType: "video-asset",
    targetId: asset.id,
    details: { title: asset.title },
    success: true,
  });

  res.status(200).json({ data: null, error: false, message: "Video deleted" });
});

export default adminVideosHandler;
